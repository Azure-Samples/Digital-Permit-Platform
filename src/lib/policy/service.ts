import { Prisma } from "@prisma/client";
import type { ImportedPolicySection } from "./import";
import { prisma } from "@/lib/db";

export const MAX_ACTIVE_POLICY_GROUNDING_CHARACTERS = 120_000;

export interface PolicyImportInput {
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
  uploadedById: string;
  sections: ImportedPolicySection[];
}

export async function importPolicyVersion(input: PolicyImportInput) {
  if (input.sections.length === 0) {
    throw new Error("POLICY_HAS_NO_SECTIONS");
  }

  return prisma.$transaction(async (transaction) => {
    const policy = await transaction.licensingPolicy.create({
      data: {
        councilName: input.councilName,
        title: input.title,
        regime: "licensing_act_2003",
        versionLabel: input.versionLabel,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        summary: input.summary,
        isActive: false,
        sourceFilename: input.sourceFilename,
        sourceMimeType: input.sourceMimeType,
        sourceFileData: input.sourceFileData,
        sourceHash: input.sourceHash,
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
              sections: { select: { content: true } },
            },
          });
          if (!policy) throw new Error("POLICY_NOT_FOUND");

          const groundingCharacters = policy.sections.reduce(
            (total, section) => total + section.content.length,
            0,
          );
          if (groundingCharacters > MAX_ACTIVE_POLICY_GROUNDING_CHARACTERS) {
            throw new Error("POLICY_GROUNDING_TOO_LARGE");
          }

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
  return prisma.$transaction(async (transaction) => {
    const policy = await transaction.licensingPolicy.findUnique({
      where: { id: policyId },
      select: { id: true, title: true, versionLabel: true, isActive: true },
    });
    if (!policy) throw new Error("POLICY_NOT_FOUND");
    if (policy.isActive) throw new Error("ACTIVE_POLICY_DELETE_FORBIDDEN");

    await transaction.licensingPolicy.delete({ where: { id: policy.id } });
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
  });
}