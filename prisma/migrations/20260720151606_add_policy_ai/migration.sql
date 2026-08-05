-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'FAILED');

-- CreateTable
CREATE TABLE "licensing_policies" (
    "id" TEXT NOT NULL,
    "councilName" TEXT NOT NULL DEFAULT 'Contoso Council',
    "title" TEXT NOT NULL,
    "regime" TEXT NOT NULL DEFAULT 'licensing_act_2003',
    "versionLabel" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "summary" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licensing_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_sections" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licence_analyses" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL DEFAULT 'upload',
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "fileData" BYTEA,
    "extractedText" TEXT,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "summary" JSONB,
    "compliance" JSONB,
    "model" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "uploadedById" TEXT NOT NULL,
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licence_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_policy_insights" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "ragRating" TEXT,
    "insight" JSONB,
    "model" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "generatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_policy_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_conversations" (
    "id" TEXT NOT NULL,
    "persona" TEXT NOT NULL DEFAULT 'applicant',
    "language" TEXT NOT NULL DEFAULT 'en',
    "title" TEXT,
    "userId" TEXT,
    "analysisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "licensing_policies_isActive_idx" ON "licensing_policies"("isActive");

-- CreateIndex
CREATE INDEX "policy_sections_policyId_idx" ON "policy_sections"("policyId");

-- CreateIndex
CREATE INDEX "policy_sections_category_idx" ON "policy_sections"("category");

-- CreateIndex
CREATE INDEX "licence_analyses_uploadedById_idx" ON "licence_analyses"("uploadedById");

-- CreateIndex
CREATE INDEX "licence_analyses_status_idx" ON "licence_analyses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "application_policy_insights_applicationId_key" ON "application_policy_insights"("applicationId");

-- CreateIndex
CREATE INDEX "assistant_conversations_userId_idx" ON "assistant_conversations"("userId");

-- CreateIndex
CREATE INDEX "assistant_conversations_persona_idx" ON "assistant_conversations"("persona");

-- CreateIndex
CREATE INDEX "assistant_messages_conversationId_idx" ON "assistant_messages"("conversationId");

-- AddForeignKey
ALTER TABLE "policy_sections" ADD CONSTRAINT "policy_sections_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "licensing_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licence_analyses" ADD CONSTRAINT "licence_analyses_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licence_analyses" ADD CONSTRAINT "licence_analyses_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_policy_insights" ADD CONSTRAINT "application_policy_insights_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_conversations" ADD CONSTRAINT "assistant_conversations_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "licence_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_messages" ADD CONSTRAINT "assistant_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
