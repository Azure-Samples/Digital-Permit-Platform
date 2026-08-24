// ─────────────────────────────────────────────────────────────
// Licence analysis orchestration service
// ─────────────────────────────────────────────────────────────
// Runs the (slow) AI pipeline for an uploaded licence in the
// background: extract text → at-a-glance summary → policy
// compliance. Persists progress to LicenceAnalysis so the client
// can poll. The app runs as a long-lived Node server (Azure
// Container Apps), so fire-and-forget processing is safe here.
// ─────────────────────────────────────────────────────────────
import { prisma } from "@/lib/db";
import { AI_MODEL } from "./openai";
import { getActivePolicyContext } from "./policy-context";
import {
  extractLicenceText,
  analyseLicence,
  assessCompliance,
  assessApplication,
} from "./policy-assistant";
import type { LicenceSummary } from "./types";
import { policyRegimeForModule } from "@/lib/policy/regimes";

/** Build a compact plain-text description of a licence for chat grounding. */
export function licenceContextFromSummary(summary: LicenceSummary): string {
  const isTaxiDocument = /(?:taxi|private hire|hackney)/i.test(summary.documentType);
  const lines: string[] = [
    `Document type: ${summary.documentType}`,
    summary.licenceNumber ? `Licence number: ${summary.licenceNumber}` : "",
    summary.premisesName
      ? `${isTaxiDocument ? "Licensed subject" : "Premises"}: ${summary.premisesName}`
      : "",
    summary.premisesAddress ? `Address: ${summary.premisesAddress}` : "",
    summary.licenceHolder ? `Licence holder: ${summary.licenceHolder}` : "",
    !isTaxiDocument && summary.designatedPremisesSupervisor?.name
      ? `DPS: ${summary.designatedPremisesSupervisor.name} (${summary.designatedPremisesSupervisor.personalLicenceNumber ?? "no number"})`
      : "",
    summary.openingHours ? `Opening hours: ${summary.openingHours}` : "",
    isTaxiDocument ? "Licence scope and restrictions:" : "Licensable activities:",
    ...summary.licensableActivities.map(
      (a) => `  - ${a.activity}${a.hours ? ` (${a.days ?? ""} ${a.hours})` : ""}`
    ),
    "Operating schedule conditions:",
    ...summary.operatingScheduleConditions.map((c) => `  - ${c.text}`),
    "Responsible authority conditions:",
    ...summary.responsibleAuthorityConditions.map(
      (c) => `  - ${c.text}${c.source ? ` [${c.source}]` : ""}`
    ),
  ];
  return lines.filter(Boolean).join("\n");
}

/**
 * Process an analysis end-to-end. Safe to call fire-and-forget; all
 * errors are captured on the record. Never throws.
 */
export async function runLicenceAnalysis(analysisId: string): Promise<void> {
  try {
    await prisma.licenceAnalysis.update({
      where: { id: analysisId },
      data: { status: "PROCESSING", errorMessage: null },
    });

    const record = await prisma.licenceAnalysis.findUnique({
      where: { id: analysisId },
    });
    if (!record) return;

    // 1. Resolve the licence text (either already provided or from a file).
    let text = record.extractedText ?? "";
    if (!text && record.fileData) {
      const { text: extracted, note } = await extractLicenceText(
        Buffer.from(record.fileData),
        record.mimeType ?? "application/pdf"
      );
      text = extracted;
      if (!text) {
        await prisma.licenceAnalysis.update({
          where: { id: analysisId },
          data: {
            status: "FAILED",
            errorMessage:
              note ?? "No readable text could be extracted from the document.",
          },
        });
        return;
      }
      await prisma.licenceAnalysis.update({
        where: { id: analysisId },
        data: { extractedText: text },
      });
    }

    if (!text.trim()) {
      await prisma.licenceAnalysis.update({
        where: { id: analysisId },
        data: { status: "FAILED", errorMessage: "No licence text to analyse." },
      });
      return;
    }

    // 2. At-a-glance summary.
    const { summary, tokensUsed: t1 } = await analyseLicence(text);

    // 3. Compliance vs the active policy (if one is configured).
    const policyCtx = await getActivePolicyContext(
      policyRegimeForModule(
        summary.documentType,
        `${summary.documentType}\n${text.slice(0, 5_000)}`,
      ),
    );
    let compliance = null;
    let t2 = 0;
    if (policyCtx && policyCtx.sections.length > 0) {
      const res = await assessCompliance(policyCtx, summary);
      compliance = res.compliance;
      t2 = res.tokensUsed;
    }

    await prisma.licenceAnalysis.update({
      where: { id: analysisId },
      data: {
        status: "COMPLETE",
        summary: summary as unknown as object,
        compliance: (compliance as unknown as object) ?? undefined,
        model: AI_MODEL,
        tokensUsed: t1 + t2,
      },
    });
  } catch (err) {
    await prisma.licenceAnalysis
      .update({
        where: { id: analysisId },
        data: {
          status: "FAILED",
          errorMessage: (err as Error).message?.slice(0, 500) ?? "Analysis failed",
        },
      })
      .catch(() => {});
  }
}

/**
 * Generate (or refresh) the cached policy-compliance insight for a
 * submitted application. Fire-and-forget; never throws.
 */
export async function runApplicationInsight(
  applicationId: string
): Promise<void> {
  let policyRegime: "licensing_act_2003" | "taxi_private_hire" | null = null;
  let policyId: string | null = null;
  let policyVersionLabel: string | null = null;
  try {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { module: true },
    });
    if (!application) return;

    policyRegime = policyRegimeForModule(
      application.module.category,
      application.module.moduleKey,
    );
    const policyCtx = await getActivePolicyContext(policyRegime);
    if (!policyCtx) {
      await prisma.applicationPolicyInsight.update({
        where: { applicationId },
        data: {
          status: "FAILED",
          errorMessage:
            policyRegime === "taxi_private_hire"
              ? "No active taxi and private hire licensing policy is configured."
              : "No active Statement of Licensing Policy is configured.",
              policyId: null,
              policyRegime,
              policyVersionLabel: null,
        },
      });
      return;
    }
    policyId = policyCtx.policyId;
    policyVersionLabel = policyCtx.versionLabel;
    if (policyCtx.sections.length === 0) {
      await prisma.applicationPolicyInsight.update({
        where: { applicationId },
        data: {
          status: "FAILED",
          errorMessage:
            "The active statement has no searchable text. Review the retained source document or upload a text-based version.",
          policyId,
          policyRegime,
          policyVersionLabel,
        },
      });
      return;
    }

    const { compliance, tokensUsed } = await assessApplication(policyCtx, {
      referenceNumber: application.referenceNumber,
      moduleName: application.module.displayName,
      answers: (application.answers as Record<string, unknown>) ?? {},
    });

    await prisma.applicationPolicyInsight.update({
      where: { applicationId },
      data: {
        status: "COMPLETE",
        ragRating: compliance.overall,
        insight: compliance as unknown as object,
        model: AI_MODEL,
        tokensUsed,
        errorMessage: null,
        policyId,
        policyRegime,
        policyVersionLabel,
      },
    });
  } catch (err) {
    await prisma.applicationPolicyInsight
      .update({
        where: { applicationId },
        data: {
          status: "FAILED",
          errorMessage: (err as Error).message?.slice(0, 500) ?? "Insight failed",
          policyId,
          policyRegime,
          policyVersionLabel,
        },
      })
      .catch(() => {});
  }
}
