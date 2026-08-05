ALTER TABLE "licensing_policies"
ADD COLUMN "sourceFilename" TEXT,
ADD COLUMN "sourceMimeType" TEXT,
ADD COLUMN "sourceFileData" BYTEA,
ADD COLUMN "sourceHash" TEXT,
ADD COLUMN "uploadedById" TEXT;

CREATE UNIQUE INDEX "licensing_policies_sourceHash_key"
ON "licensing_policies"("sourceHash");

CREATE INDEX "licensing_policies_uploadedById_idx"
ON "licensing_policies"("uploadedById");

ALTER TABLE "licensing_policies"
ADD CONSTRAINT "licensing_policies_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;