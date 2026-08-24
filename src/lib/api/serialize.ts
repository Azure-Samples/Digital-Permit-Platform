// ─────────────────────────────────────────────────────────────
// External API serialisers
// ─────────────────────────────────────────────────────────────
// Shapes internal records into a stable, minimal public contract.
// Only non-sensitive fields are exposed; applicant contact details,
// documents and free-text notes are deliberately withheld.
// ─────────────────────────────────────────────────────────────
import type { Prisma } from "@prisma/client";

export const apiApplicationInclude = {
  module: { select: { moduleKey: true, displayName: true, category: true } },
  applicant: { select: { firstName: true, lastName: true } },
  organisation: { select: { name: true } },
} satisfies Prisma.ApplicationInclude;

type ApiApplication = Prisma.ApplicationGetPayload<{
  include: typeof apiApplicationInclude;
}>;

export function serializeApplication(application: ApiApplication) {
  return {
    reference: application.referenceNumber,
    applicationType: application.applicationType,
    status: application.status,
    currentStage: application.currentStage,
    module: {
      key: application.module.moduleKey,
      name: application.module.displayName,
      category: application.module.category,
    },
    applicant: {
      name: `${application.applicant.firstName} ${application.applicant.lastName}`.trim(),
      organisation: application.organisation?.name ?? null,
    },
    decision: application.decisionOutcome
      ? { outcome: application.decisionOutcome, decidedAt: iso(application.decidedAt) }
      : null,
    submittedAt: iso(application.submittedAt),
    expiresAt: iso(application.expiresAt),
    createdAt: iso(application.createdAt),
    updatedAt: iso(application.updatedAt),
  };
}

export function serializeModule(module: {
  moduleKey: string;
  displayName: string;
  category: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    key: module.moduleKey,
    name: module.displayName,
    category: module.category,
    enabled: module.enabled,
    createdAt: iso(module.createdAt),
    updatedAt: iso(module.updatedAt),
  };
}

export function serializePolicy(policy: {
  regime: string;
  title: string;
  versionLabel: string;
  councilName: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isActive: boolean;
  updatedAt: Date;
}) {
  return {
    regime: policy.regime,
    title: policy.title,
    versionLabel: policy.versionLabel,
    councilName: policy.councilName,
    effectiveFrom: iso(policy.effectiveFrom),
    effectiveTo: iso(policy.effectiveTo),
    isActive: policy.isActive,
    updatedAt: iso(policy.updatedAt),
  };
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}
