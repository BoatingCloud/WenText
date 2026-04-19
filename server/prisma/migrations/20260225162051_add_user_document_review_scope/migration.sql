-- CreateTable
CREATE TABLE "user_document_review_scopes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_document_review_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_document_review_scopes_companyCode_idx" ON "user_document_review_scopes"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "user_document_review_scopes_userId_companyCode_key" ON "user_document_review_scopes"("userId", "companyCode");

-- AddForeignKey
ALTER TABLE "user_document_review_scopes" ADD CONSTRAINT "user_document_review_scopes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
