-- CreateEnum
CREATE TYPE "PhysicalArchiveBorrowAction" AS ENUM ('BORROW', 'RETURN');

-- CreateTable
CREATE TABLE "physical_archive_borrow_records" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "action" "PhysicalArchiveBorrowAction" NOT NULL,
    "borrower" TEXT,
    "borrowedAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "remark" TEXT,
    "operatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "physical_archive_borrow_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "physical_archive_borrow_records_archiveId_idx" ON "physical_archive_borrow_records"("archiveId");

-- CreateIndex
CREATE INDEX "physical_archive_borrow_records_action_idx" ON "physical_archive_borrow_records"("action");

-- CreateIndex
CREATE INDEX "physical_archive_borrow_records_createdAt_idx" ON "physical_archive_borrow_records"("createdAt");

-- CreateIndex
CREATE INDEX "physical_archive_borrow_records_operatorId_idx" ON "physical_archive_borrow_records"("operatorId");

-- AddForeignKey
ALTER TABLE "physical_archive_borrow_records" ADD CONSTRAINT "physical_archive_borrow_records_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "physical_archives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "physical_archive_borrow_records" ADD CONSTRAINT "physical_archive_borrow_records_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
