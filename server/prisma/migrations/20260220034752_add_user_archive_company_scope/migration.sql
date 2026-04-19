-- CreateTable
CREATE TABLE "user_archive_company_scopes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_archive_company_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_archive_company_scopes_companyCode_idx" ON "user_archive_company_scopes"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "user_archive_company_scopes_userId_companyCode_key" ON "user_archive_company_scopes"("userId", "companyCode");

-- AddForeignKey
ALTER TABLE "user_archive_company_scopes" ADD CONSTRAINT "user_archive_company_scopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
