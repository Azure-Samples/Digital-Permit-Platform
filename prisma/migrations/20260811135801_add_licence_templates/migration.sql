-- CreateTable
CREATE TABLE "licence_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "fileData" BYTEA NOT NULL,
    "placeholders" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licence_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licence_template_assignments" (
    "templateId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licence_template_assignments_pkey" PRIMARY KEY ("templateId","moduleId")
);

-- CreateIndex
CREATE INDEX "licence_templates_uploadedById_idx" ON "licence_templates"("uploadedById");

-- CreateIndex
CREATE INDEX "licence_templates_createdAt_idx" ON "licence_templates"("createdAt");

-- CreateIndex
CREATE INDEX "licence_template_assignments_moduleId_idx" ON "licence_template_assignments"("moduleId");

-- AddForeignKey
ALTER TABLE "licence_templates" ADD CONSTRAINT "licence_templates_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licence_template_assignments" ADD CONSTRAINT "licence_template_assignments_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "licence_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "licence_template_assignments" ADD CONSTRAINT "licence_template_assignments_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "licence_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
