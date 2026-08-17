CREATE TABLE "council_profiles" (
    "id" TEXT NOT NULL DEFAULT 'primary',
    "setupVersion" TEXT NOT NULL DEFAULT '1.0',
    "organisationName" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "supportEmail" TEXT NOT NULL,
    "supportPhone" TEXT NOT NULL,
    "publicDomain" TEXT,
    "primaryColour" TEXT NOT NULL DEFAULT '#0b2e5e',
    "accentColour" TEXT NOT NULL DEFAULT '#009fe3',
    "logoFileName" TEXT,
    "logoMimeType" TEXT,
    "logoHash" TEXT,
    "logoData" BYTEA,
    "deploymentProfile" TEXT NOT NULL DEFAULT 'pilot',
    "environmentName" TEXT NOT NULL,
    "azureRegion" TEXT NOT NULL,
    "enableAi" BOOLEAN NOT NULL DEFAULT false,
    "seedDemoData" BOOLEAN NOT NULL DEFAULT true,
    "authenticationMode" TEXT NOT NULL DEFAULT 'demo',
    "externalTenant" TEXT,
    "workforceTenant" TEXT,
    "selectedModules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "setupCompletedAt" TIMESTAMP(3),
    "configuredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "council_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "council_profiles_configuredById_idx"
ON "council_profiles"("configuredById");

ALTER TABLE "council_profiles"
ADD CONSTRAINT "council_profiles_configuredById_fkey"
FOREIGN KEY ("configuredById") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;