-- CreateTable
CREATE TABLE "user_physical_archive_scopes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "physicalArchiveId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_physical_archive_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_physical_archive_scopes_physicalArchiveId_idx" ON "user_physical_archive_scopes"("physicalArchiveId");

-- CreateIndex
CREATE UNIQUE INDEX "user_physical_archive_scopes_userId_physicalArchiveId_key" ON "user_physical_archive_scopes"("userId", "physicalArchiveId");

-- AddForeignKey
ALTER TABLE "user_physical_archive_scopes" ADD CONSTRAINT "user_physical_archive_scopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_physical_archive_scopes" ADD CONSTRAINT "user_physical_archive_scopes_physicalArchiveId_fkey" FOREIGN KEY ("physicalArchiveId") REFERENCES "physical_archives"("id") ON DELETE CASCADE ON UPDATE CASCADE;
