-- CreateTable
CREATE TABLE "role_archive_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "permissions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_archive_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_archive_permissions_companyCode_idx" ON "role_archive_permissions"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "role_archive_permissions_roleId_companyCode_key" ON "role_archive_permissions"("roleId", "companyCode");

-- AddForeignKey
ALTER TABLE "role_archive_permissions" ADD CONSTRAINT "role_archive_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
