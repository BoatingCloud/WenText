-- AlterTable
ALTER TABLE "physical_archives"
ADD COLUMN "fileNo" TEXT,
ADD COLUMN "fileType" TEXT,
ADD COLUMN "formedAt" TIMESTAMP(3),
ADD COLUMN "expiresAt" TIMESTAMP(3),
ADD COLUMN "belongCategory" TEXT,
ADD COLUMN "controlMark" TEXT;
