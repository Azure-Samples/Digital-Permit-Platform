import { Prisma } from "@prisma/client";
import type { ImportedPolicySection } from "./import";
import { prisma } from "@/lib/db";
import type { PolicyRegime } from "./regimes";

export type PolicyLifecycleStatus = "active" | "superseded" | "draft";
export type PolicyReviewStatus = "current" | "expires-soon" | "expired";

export function getPolicyLifecycleStatus(
  isActive: boolean,
  hasBeenActive: boolean,
): PolicyLifecycleStatus {
  if (isActive) return "active";
  return hasBeenActive ? "superseded" : "draft";
}

export function getPolicyReviewStatus(
  effectiveTo: Date | null,
  now = new Date(),
): PolicyReviewStatus {
  if (!effectiveTo) return "current";
  if (effectiveTo.getTime() < now.getTime()) return "expired";
  const reviewWindowEnds = now.getTime() + 90 * 24 * 60 * 60 * 1_000;
  return effectiveTo.getTime() <= reviewWindowEnds ? "expires-soon" : "current";
}

export interface PolicyImportInput {
  regime: PolicyRegime;
  councilName: string;
  title: string;
  versionLabel: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  summary: string;
  sourceFilename: string;
  sourceMimeType: string;
  sourceFileData: Uint8Array<ArrayBuffer>;
  sourceHash: string;
  searchIndexTruncated: boolean;
  searchableCharacters: number;
  uploadedById: string;
  sections: ImportedPolicySection[];
}

export async function importPolicyVersion(input: PolicyImportInput) {
  return prisma.$transaction(async (transaction) => {
    const policy = await transaction.licensingPolicy.create({
      data: {
        councilName: input.councilName,
        title: input.title,
        regime: input.regime,
        versionLabel: input.versionLabel,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        summary: input.summary,
        isActive: false,
        sourceFilename: input.sourceFilename,
        sourceMimeType: input.sourceMimeType,
        sourceFileData: input.sourceFileData,
        sourceHash: input.sourceHash,
        searchIndexTruncated: input.searchIndexTruncated,
        searchableCharacters: input.searchableCharacters,
        uploadedById: input.uploadedById,
        sections: {
          create: input.sections.map((section) => ({
            ref: section.ref,
            heading: section.heading,
            content: section.content,
            category: section.category,
            keywords: section.keywords,
            sortOrder: section.sortOrder,
          })),
        },
      },
      select: {
        id: true,
        title: true,
        versionLabel: true,
        isActive: true,
      },
    });

    await transaction.auditLog.create({
      data: {
        userId: input.uploadedById,
        action: "policy.import",
        entityType: "LicensingPolicy",
        entityId: policy.id,
        newValues: {
          title: policy.title,
          regime: input.regime,
          versionLabel: policy.versionLabel,
          sections: input.sections.length,
          sourceFilename: input.sourceFilename,
          sourceHash: input.sourceHash,
          status: "draft",
        },
      },
    });
    return { ...policy, sectionCount: input.sections.length };
  });
}

export async function activatePolicyVersion(policyId: string, userId: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const policy = await transaction.licensingPolicy.findUnique({
            where: { id: policyId },
            select: {
              id: true,
              title: true,
              regime: true,
              isActive: true,
            },
          });
          if (!policy) throw new Error("POLICY_NOT_FOUND");

          const previous = await transaction.licensingPolicy.findFirst({
            where: { regime: policy.regime, isActive: true },
            select: { id: true, title: true },
          });
          if (policy.isActive) {
            await transaction.auditLog.create({
              data: {
                userId,
                action: "policy.activate_noop",
                entityType: "LicensingPolicy",
                entityId: policy.id,
                newValues: { activePolicyId: policy.id, alreadyActive: true },
              },
            });
            return policy;
          }

          await transaction.licensingPolicy.updateMany({
            where: { regime: policy.regime, isActive: true },
            data: { isActive: false },
          });
          const activated = await transaction.licensingPolicy.update({
            where: { id: policy.id },
            data: { isActive: true },
            select: { id: true, title: true, regime: true, isActive: true },
          });
          if (previous) {
            await transaction.auditLog.create({
              data: {
                userId,
                action: "policy.supersede",
                entityType: "LicensingPolicy",
                entityId: previous.id,
                previousValues: {
                  activePolicyId: previous.id,
                  activePolicyTitle: previous.title,
                },
                newValues: {
                  replacementPolicyId: activated.id,
                  replacementPolicyTitle: activated.title,
                },
              },
            });
          }
          await transaction.auditLog.create({
            data: {
              userId,
              action: "policy.activate",
              entityType: "LicensingPolicy",
              entityId: policy.id,
              previousValues: previous
                ? { activePolicyId: previous.id, activePolicyTitle: previous.title }
                : undefined,
              newValues: {
                activePolicyId: activated.id,
                activePolicyTitle: activated.title,
              },
            },
          });
          return activated;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        new Set(["P2002", "P2034"]).has(error.code);
      if (retryable && attempt === 0) continue;
      if (retryable) throw new Error("POLICY_ACTIVATION_CONFLICT");
      throw error;
    }
  }
  throw new Error("POLICY_ACTIVATION_CONFLICT");
}

export async function deletePolicyDraft(policyId: string, userId: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const policy = await transaction.licensingPolicy.findUnique({
            where: { id: policyId },
            select: { id: true, title: true, versionLabel: true, isActive: true },
          });
          if (!policy) throw new Error("POLICY_NOT_FOUND");
          if (policy.isActive) throw new Error("ACTIVE_POLICY_DELETE_FORBIDDEN");
          const activation = await transaction.auditLog.findFirst({
            where: {
              action: { in: ["policy.activate", "policy.supersede"] },
              entityType: "LicensingPolicy",
              entityId: policy.id,
            },
            select: { id: true },
          });
          if (activation) throw new Error("POLICY_HISTORY_DELETE_FORBIDDEN");

          const deleted = await transaction.licensingPolicy.deleteMany({
            where: { id: policy.id, isActive: false },
          });
          if (deleted.count !== 1) throw new Error("POLICY_DELETE_CONFLICT");
          await transaction.auditLog.create({
            data: {
              userId,
              action: "policy.delete_draft",
              entityType: "LicensingPolicy",
              entityId: policy.id,
              previousValues: {
                title: policy.title,
                versionLabel: policy.versionLabel,
                status: "draft",
              },
            },
          });
          return policy;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";
      if (retryable && attempt === 0) continue;
      if (retryable) throw new Error("POLICY_DELETE_CONFLICT");
      throw error;
    }
  }
  throw new Error("POLICY_DELETE_CONFLICT");
}