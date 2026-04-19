-- AlterTable
ALTER TABLE "physical_archives" ADD COLUMN     "companyCode" TEXT;

-- CreateTable
CREATE TABLE "physical_archive_attachments" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileExtension" TEXT,
    "fileSize" BIGINT NOT NULL,
    "mimeType" TEXT,
    "storagePath" TEXT NOT NULL,
    "md5" TEXT,
    "uploaderId" TEXT NOT NULL,
    "remark" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "physical_archive_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "physical_archive_attachments_archiveId_idx" ON "physical_archive_attachments"("archiveId");

-- CreateIndex
CREATE INDEX "physical_archives_companyCode_idx" ON "physical_archives"("companyCode");

-- AddForeignKey
ALTER TABLE "physical_archive_attachments" ADD CONSTRAINT "physical_archive_attachments_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "physical_archives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_archive_attachments" ADD CONSTRAINT "physical_archive_attachments_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
