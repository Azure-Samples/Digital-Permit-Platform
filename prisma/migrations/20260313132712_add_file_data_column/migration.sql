-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "fileData" BYTEA,
ALTER COLUMN "storagePath" SET DEFAULT 'db';
