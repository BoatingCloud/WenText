-- AlterTable
ALTER TABLE "manual_review_annotations" ADD COLUMN     "attachmentId" TEXT;

-- AddForeignKey
ALTER TABLE "manual_review_annotations" ADD CONSTRAINT "manual_review_annotations_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "document_review_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
