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
  sanitizePolicyFilename,
} from "../src/lib/policy/document";
import { isTrustedMutationOrigin } from "../src/lib/http/origin";

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