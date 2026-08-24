import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Document, Packer, Paragraph } from "docx";
import {
  buildPolicySummary,
  normalizePolicyText,
  splitPolicyIntoSections,
} from "../src/lib/policy/import";
import {
  detectPolicyDocumentType,
  extractPolicyDocumentText,
  MAX_POLICY_FILE_SIZE_MB,
  MAX_POLICY_TEXT_CHARACTERS,
  PolicyTextUnavailableError,
  sanitizePolicyFilename,
} from "../src/lib/policy/document";
import { isTrustedMutationOrigin } from "../src/lib/http/origin";
import {
  getPolicyLifecycleStatus,
  getPolicyReviewStatus,
} from "../src/lib/policy/service";
import {
  buildCombinedPolicyGroundingText,
  buildPolicyGroundingText,
  detectPolicyRegimes,
  selectPolicyContexts,
  type PolicyContext,
} from "../src/lib/ai/policy-context";
import {
  getTaxiPolicyReadiness,
  isPolicyRegime,
  isTaxiModule,
  policyRegimeForModule,
} from "../src/lib/policy/regimes";
import {
  canAccessConversation,
  createConversationAccessKey,
  hashConversationAccessKey,
} from "../src/lib/ai/conversation-access";
import { isPolicyInsightCurrent } from "../src/lib/policy/insight-provenance";
import {
  checkRateLimit,
  clearRateLimitsForTests,
} from "../src/lib/http/rate-limit";

const POLICY_TEXT = `Example Council Statement of Licensing Policy 2026-2031

1 Introduction and scope
This policy explains how the authority promotes the licensing objectives.

2 The licensing objectives
The prevention of crime and disorder, public safety, prevention of public nuisance and protection of children are central to every decision.

3.1 Cumulative impact assessment
The city centre cumulative impact area creates a rebuttable presumption for relevant applications.

4 Conditions and operating schedules
Applicants should propose proportionate conditions in the operating schedule.`;

describe("policy import", () => {
  it("maps taxi modules and policy readiness without making policy statutory", () => {
    assert.equal(isPolicyRegime("licensing_act_2003"), true);
    assert.equal(isPolicyRegime("taxi_private_hire"), true);
    assert.equal(isPolicyRegime("gambling_act_2005"), false);
    assert.equal(isTaxiModule("Taxis and private hire"), true);
    assert.equal(isTaxiModule("Other", "hackney_carriage_vehicle_new"), true);
    assert.equal(isTaxiModule("Alcohol and entertainment", "premises_new"), false);
    assert.equal(
      policyRegimeForModule("Taxis and private hire", "taxi_driver_new"),
      "taxi_private_hire",
    );
    assert.equal(
      policyRegimeForModule("Alcohol and entertainment", "premises_new"),
      "licensing_act_2003",
    );
    assert.equal(getTaxiPolicyReadiness(true, true), "ready");
    assert.equal(getTaxiPolicyReadiness(true, false), "policy-missing");
    assert.equal(getTaxiPolicyReadiness(false, true), "modules-disabled");
    assert.equal(getTaxiPolicyReadiness(false, false), "not-applicable");
  });

  it("distinguishes active statements, retained history, and drafts", () => {
    assert.equal(getPolicyLifecycleStatus(true, true), "active");
    assert.equal(getPolicyLifecycleStatus(true, false), "active");
    assert.equal(getPolicyLifecycleStatus(false, true), "superseded");
    assert.equal(getPolicyLifecycleStatus(false, false), "draft");
  });

  it("flags active statements that are expired or approaching review", () => {
    const now = new Date("2026-08-12T12:00:00.000Z");
    assert.equal(getPolicyReviewStatus(null, now), "current");
    assert.equal(
      getPolicyReviewStatus(new Date("2026-08-11T23:59:59.999Z"), now),
      "expired",
    );
    assert.equal(
      getPolicyReviewStatus(new Date("2026-10-01T23:59:59.999Z"), now),
      "expires-soon",
    );
    assert.equal(
      getPolicyReviewStatus(new Date("2027-01-01T00:00:00.000Z"), now),
      "current",
    );
  });

  it("retrieves relevant excerpts from a long policy within the prompt budget", () => {
    const context: PolicyContext = {
      policyId: "policy-1",
      regime: "licensing_act_2003",
      councilName: "Example Council",
      title: "Statement of Licensing Policy",
      versionLabel: "2026-2031",
      summary: "The council licensing policy.",
      sourceFilename: "policy.pdf",
      sourceMimeType: "application/pdf",
      sections: [
        {
          ref: "1",
          heading: "General administration",
          category: "general",
          content: "Routine administration and contact details. ".repeat(300),
        },
        {
          ref: "8.2",
          heading: "Cumulative impact area",
          category: "cumulative_impact",
          content: `${"Town centre evidence. ".repeat(150)}Applications in the cumulative impact area must rebut the presumption.`,
        },
        ...Array.from({ length: 20 }, (_, index) => ({
          ref: `20.${index + 1}`,
          heading: `Other policy section ${index + 1}`,
          category: "general",
          content: "Unrelated policy text. ".repeat(300),
        })),
      ],
    };

    const grounding = buildPolicyGroundingText(
      context,
      "Does the cumulative impact area affect this town centre application?",
      8_000,
    );
    assert.ok(grounding.length <= 8_000);
    assert.match(grounding, /\[licensing_act_2003:8\.2\] Cumulative impact area/);
    assert.match(grounding, /rebut the presumption/);
    assert.ok(grounding.length < context.sections.reduce((total, section) => total + section.content.length, 0));
  });

  it("routes unified Copilot questions to the relevant active policy regimes", () => {
    const licensingContext: PolicyContext = {
      policyId: "licensing-policy",
      regime: "licensing_act_2003",
      councilName: "Example Council",
      title: "Statement of Licensing Policy",
      versionLabel: "2026-2031",
      summary: "Licensing Act policy",
      sourceFilename: null,
      sourceMimeType: null,
      sections: [{ ref: "1", heading: "Alcohol", category: "general", content: "Challenge 25" }],
    };
    const taxiContext: PolicyContext = {
      ...licensingContext,
      policyId: "taxi-policy",
      regime: "taxi_private_hire",
      title: "Hackney carriage and private hire licensing policy",
      summary: "Taxi policy",
      sections: [{ ref: "4", heading: "Drivers", category: "general", content: "Fit and proper test" }],
    };
    const contexts = [licensingContext, taxiContext];

    assert.deepEqual(detectPolicyRegimes("Can a private hire driver work here?"), [
      "taxi_private_hire",
    ]);
    assert.deepEqual(detectPolicyRegimes("How does Challenge 25 work?"), [
      "licensing_act_2003",
    ]);
    assert.deepEqual(detectPolicyRegimes("What policies apply locally?"), [
      "licensing_act_2003",
      "taxi_private_hire",
    ]);
    assert.deepEqual(
      detectPolicyRegimes("Does that also apply to renewals?", ["taxi_private_hire"]),
      ["taxi_private_hire"],
    );
    assert.deepEqual(
      detectPolicyRegimes("What about Challenge 25?", ["taxi_private_hire"]),
      ["licensing_act_2003"],
    );
    assert.deepEqual(
      selectPolicyContexts(contexts, "What is the taxi fit and proper test?").contexts.map(
        (context) => context.regime,
      ),
      ["taxi_private_hire"],
    );
    assert.deepEqual(
      selectPolicyContexts([licensingContext], "What is the taxi fit and proper test?")
        .missingRegimes,
      ["taxi_private_hire"],
    );
    const combined = buildCombinedPolicyGroundingText(contexts, "Compare local policies", 4_000);
    assert.match(combined, /POLICY KEY: licensing_act_2003/);
    assert.match(combined, /POLICY KEY: taxi_private_hire/);
    assert.ok(combined.length <= 4_000);
  });

  it("binds staff conversations to users and public conversations to a secret key", () => {
    const accessKey = createConversationAccessKey();
    const accessKeyHash = hashConversationAccessKey(accessKey);
    assert.equal(
      canAccessConversation({
        conversationUserId: "user-1",
        conversationPersona: "officer",
        requestedPersona: "officer",
        sessionUserId: "user-1",
        accessKeyHash: null,
        suppliedAccessKey: null,
      }),
      true,
    );
    assert.equal(
      canAccessConversation({
        conversationUserId: "user-1",
        conversationPersona: "officer",
        requestedPersona: "officer",
        sessionUserId: "user-2",
        accessKeyHash: null,
        suppliedAccessKey: null,
      }),
      false,
    );
    assert.equal(
      canAccessConversation({
        conversationUserId: null,
        conversationPersona: "applicant",
        requestedPersona: "applicant",
        sessionUserId: null,
        accessKeyHash,
        suppliedAccessKey: accessKey,
      }),
      true,
    );
    assert.equal(
      canAccessConversation({
        conversationUserId: null,
        conversationPersona: "applicant",
        requestedPersona: "officer",
        sessionUserId: null,
        accessKeyHash,
        suppliedAccessKey: accessKey,
      }),
      false,
    );
    assert.equal(
      canAccessConversation({
        conversationUserId: null,
        conversationPersona: "applicant",
        requestedPersona: "applicant",
        sessionUserId: null,
        accessKeyHash,
        suppliedAccessKey: "wrong-key",
      }),
      false,
    );
  });

  it("limits anonymous chat requests within a bounded window", () => {
    clearRateLimitsForTests();
    const options = { max: 2, windowMs: 60_000 };
    assert.equal(checkRateLimit("anonymous", options, 1_000).allowed, true);
    assert.equal(checkRateLimit("anonymous", options, 1_001).allowed, true);
    const blocked = checkRateLimit("anonymous", options, 1_002);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.equal(checkRateLimit("anonymous", options, 61_001).allowed, true);
    clearRateLimitsForTests();
  });

  it("invalidates cached insights when policy provenance changes", () => {
    const insight = {
      policyId: "policy-1",
      policyRegime: "taxi_private_hire",
      policyVersionLabel: "2026",
    };
    assert.equal(
      isPolicyInsightCurrent(insight, {
        id: "policy-1",
        regime: "taxi_private_hire",
        versionLabel: "2026",
      }),
      true,
    );
    assert.equal(
      isPolicyInsightCurrent(insight, {
        id: "policy-2",
        regime: "taxi_private_hire",
        versionLabel: "2031",
      }),
      false,
    );
    assert.equal(
      isPolicyInsightCurrent(
        { policyId: null, policyRegime: null, policyVersionLabel: null },
        { id: "policy-1", regime: "licensing_act_2003", versionLabel: "2026" },
      ),
      false,
    );
  });

  it("retrieves evidence near the end of a long policy section", () => {
    const context: PolicyContext = {
      policyId: "taxi-policy",
      regime: "taxi_private_hire",
      councilName: "Example Council",
      title: "Taxi licensing policy",
      versionLabel: "2026",
      summary: "Taxi policy",
      sourceFilename: "taxi.pdf",
      sourceMimeType: "application/pdf",
      sections: [
        {
          ref: "6.2",
          heading: "Driver requirements",
          category: "general",
          content: `Driver administration. ${"Unrelated introductory material. ".repeat(450)}Applicants must provide a current Group 2 medical certificate.`,
        },
        {
          ref: "9",
          heading: "General records",
          category: "general",
          content: "General record keeping. ".repeat(300),
        },
      ],
    };

    const grounding = buildPolicyGroundingText(
      context,
      "Is a Group 2 medical certificate required for a driver?",
      8_000,
    );
    assert.match(grounding, /Group 2 medical certificate/);
    assert.match(grounding, /\[taxi_private_hire:6\.2\]/);
    assert.ok(grounding.length <= 8_000);
  });

  it("normalizes extracted document text", () => {
    assert.equal(
      normalizePolicyText(" First\u00a0line \r\n\r\n\r\n Second\tline "),
      "First line\n\nSecond line",
    );
  });

  it("splits numbered headings and infers policy categories", () => {
    const sections = splitPolicyIntoSections(POLICY_TEXT);
    assert.deepEqual(
      sections.map(({ ref, heading, category }) => ({ ref, heading, category })),
      [
        { ref: "0", heading: "Policy overview", category: "general" },
        { ref: "1", heading: "Introduction and scope", category: "objectives" },
        { ref: "2", heading: "The licensing objectives", category: "objectives" },
        {
          ref: "3.1",
          heading: "Cumulative impact assessment",
          category: "cumulative_impact",
        },
        {
          ref: "4",
          heading: "Conditions and operating schedules",
          category: "conditions",
        },
      ],
    );
    assert.ok(sections[2].keywords.includes("crime and disorder"));
  });

  it("falls back to bounded chunks when headings cannot be detected", () => {
    const sections = splitPolicyIntoSections(
      `${"A policy paragraph without numbered headings. ".repeat(100)}\n\n${"A second policy paragraph. ".repeat(100)}`,
    );
    assert.ok(sections.length >= 1);
    assert.equal(sections[0].ref, "1");
    assert.equal(sections[0].heading, "Policy overview");
    const singleParagraph = splitPolicyIntoSections("word ".repeat(4_000));
    assert.ok(singleParagraph.length > 1);
    assert.ok(singleParagraph.every((section) => section.content.length <= 6_000));
  });

  it("builds a bounded human-readable summary", () => {
    const summary = buildPolicySummary(POLICY_TEXT, 100);
    assert.ok(summary.length <= 103);
    assert.ok(summary.endsWith("..."));
  });

  it("validates document type using both MIME type and extension", () => {
    assert.equal(detectPolicyDocumentType("policy.pdf", "application/pdf"), "pdf");
    assert.equal(
      detectPolicyDocumentType(
        "policy.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
      "docx",
    );
    assert.equal(detectPolicyDocumentType("policy.exe", "application/pdf"), null);
    assert.equal(sanitizePolicyFilename("../../Policy\u0000.docx"), "Policy.docx");
    const longFilename = sanitizePolicyFilename(`${"a".repeat(300)}.pdf`);
    assert.ok(longFilename.length <= 240);
    assert.ok(longFilename.endsWith(".pdf"));
  });

  it("extracts readable text from DOCX policy uploads", async () => {
    const document = new Document({
      sections: [
        {
          children: [
            new Paragraph("Example Council Statement of Licensing Policy"),
            new Paragraph(POLICY_TEXT),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(document);
    const text = await extractPolicyDocumentText(
      buffer,
      "policy.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    assert.match(text, /Cumulative impact assessment/);
  });

  it("classifies a valid source without enough searchable text", async () => {
    await assert.rejects(
      () =>
        extractPolicyDocumentText(
          Buffer.from("Short source document"),
          "short-policy.txt",
          "text/plain",
        ),
      (error) => error instanceof PolicyTextUnavailableError,
    );
  });

  it("caps only the searchable index for very long source text", async () => {
    const source = `Long statement of licensing policy\n\n${"licensing objective and local policy evidence ".repeat(60_000)}`;
    const text = await extractPolicyDocumentText(
      Buffer.from(source),
      "long-policy.txt",
      "text/plain",
    );

    assert.equal(MAX_POLICY_FILE_SIZE_MB, 50);
    assert.equal(text.length, MAX_POLICY_TEXT_CHARACTERS);
    assert.match(text, /^Long statement of licensing policy/);
  });

  it("accepts only same-origin authenticated mutation requests", () => {
    assert.equal(
      isTrustedMutationOrigin(
        new Request("https://permits.example.gov.uk/api/admin/policies", {
          headers: { origin: "https://permits.example.gov.uk" },
        }),
        "https://permits.example.gov.uk",
      ),
      true,
    );
    assert.equal(
      isTrustedMutationOrigin(
        new Request("https://permits.example.gov.uk/api/admin/policies", {
          headers: { origin: "https://attacker.example" },
        }),
        "https://permits.example.gov.uk",
      ),
      false,
    );
    assert.equal(
      isTrustedMutationOrigin(
        new Request("https://permits.example.gov.uk/api/admin/policies"),
        "https://permits.example.gov.uk",
      ),
      false,
    );
  });
});