ALTER TABLE "users"
ALTER COLUMN "passwordHash" DROP NOT NULL;

CREATE TABLE "external_identities" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "emailAtLink" TEXT,
    "userId" TEXT NOT NULL,
    "lastSignInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_identities_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_identities_issuer_subject_key"
ON "external_identities"("issuer", "subject");

CREATE INDEX "external_identities_userId_idx"
ON "external_identities"("userId");

CREATE INDEX "external_identities_provider_idx"
ON "external_identities"("provider");

ALTER TABLE "external_identities"
ADD CONSTRAINT "external_identities_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;