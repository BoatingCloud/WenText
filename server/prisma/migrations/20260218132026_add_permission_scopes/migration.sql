-- AlterTable
ALTER TABLE "repositories" ADD COLUMN     "companyCode" TEXT;

-- CreateTable
CREATE TABLE "user_company_scopes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_company_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_repository_scopes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_repository_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_company_scopes_companyCode_idx" ON "user_company_scopes"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "user_company_scopes_userId_companyCode_key" ON "user_company_scopes"("userId", "companyCode");

-- CreateIndex
CREATE INDEX "user_repository_scopes_repositoryId_idx" ON "user_repository_scopes"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "user_repository_scopes_userId_repositoryId_key" ON "user_repository_scopes"("userId", "repositoryId");

-- CreateIndex
CREATE INDEX "repositories_companyCode_status_idx" ON "repositories"("companyCode", "status");

-- AddForeignKey
ALTER TABLE "user_company_scopes" ADD CONSTRAINT "user_company_scopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_repository_scopes" ADD CONSTRAINT "user_repository_scopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_repository_scopes" ADD CONSTRAINT "user_repository_scopes_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
