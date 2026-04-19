-- CreateEnum
CREATE TYPE "PhysicalArchiveStatus" AS ENUM ('IN_STOCK', 'BORROWED', 'LOST', 'DESTROYED');

-- CreateTable
CREATE TABLE "physical_archives" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "archiveNo" TEXT NOT NULL,
    "categoryName" TEXT,
    "fondsName" TEXT,
    "fondsCode" TEXT,
    "year" INTEGER,
    "shelfLocation" TEXT NOT NULL,
    "retentionPeriod" TEXT,
    "securityLevel" TEXT,
    "copies" INTEGER NOT NULL DEFAULT 1,
    "pages" INTEGER,
    "responsibleUnit" TEXT,
    "transferDepartment" TEXT,
    "boxNo" TEXT,
    "status" "PhysicalArchiveStatus" NOT NULL DEFAULT 'IN_STOCK',
    "borrower" TEXT,
    "borrowedAt" TIMESTAMP(3),
    "borrowRemark" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "remark" TEXT,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "physical_archives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "physical_archives_archiveNo_key" ON "physical_archives"("archiveNo");

-- CreateIndex
CREATE INDEX "physical_archives_archiveNo_idx" ON "physical_archives"("archiveNo");

-- CreateIndex
CREATE INDEX "physical_archives_title_idx" ON "physical_archives"("title");

-- CreateIndex
CREATE INDEX "physical_archives_status_idx" ON "physical_archives"("status");

-- CreateIndex
CREATE INDEX "physical_archives_year_idx" ON "physical_archives"("year");

-- CreateIndex
CREATE INDEX "physical_archives_creatorId_idx" ON "physical_archives"("creatorId");

-- AddForeignKey
ALTER TABLE "physical_archives" ADD CONSTRAINT "physical_archives_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
