DROP INDEX IF EXISTS "licensing_policies_sourceHash_key";

CREATE UNIQUE INDEX "licensing_policies_regime_sourceHash_key"
ON "licensing_policies"("regime", "sourceHash");

ALTER TABLE "licensing_policies"
ADD COLUMN "searchIndexTruncated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "searchableCharacters" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "application_policy_insights"
ADD COLUMN "policyId" TEXT,
ADD COLUMN "policyRegime" TEXT,
ADD COLUMN "policyVersionLabel" TEXT;

CREATE INDEX "application_policy_insights_policyId_idx"
ON "application_policy_insights"("policyId");

CREATE INDEX "application_policy_insights_policyRegime_idx"
ON "application_policy_insights"("policyRegime");

ALTER TABLE "application_policy_insights"
ADD CONSTRAINT "application_policy_insights_policyId_fkey"
FOREIGN KEY ("policyId") REFERENCES "licensing_policies"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assistant_conversations"
ADD COLUMN "policyRegimes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "accessKeyHash" TEXT;