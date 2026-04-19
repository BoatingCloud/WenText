-- CreateEnum
CREATE TYPE "BorrowRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVE', 'REJECT');

-- DropIndex
DROP INDEX "physical_archives_keywords_idx";

-- CreateTable
CREATE TABLE "archive_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "archive_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrow_workflow_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrow_workflow_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrow_workflow_nodes" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nodeOrder" INTEGER NOT NULL,
    "approverType" TEXT NOT NULL,
    "approverValue" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrow_workflow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrow_requests" (
    "id" TEXT NOT NULL,
    "archiveId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "workflowId" TEXT,
    "status" "BorrowRequestStatus" NOT NULL DEFAULT 'PENDING',
    "borrowReason" TEXT,
    "expectedBorrowAt" TIMESTAMP(3),
    "expectedReturnAt" TIMESTAMP(3),
    "currentNodeOrder" INTEGER NOT NULL DEFAULT 1,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrow_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrow_approval_records" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "nodeOrder" INTEGER NOT NULL,
    "nodeName" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "comment" TEXT,
    "signatureUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrow_approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_todos" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_todos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archive_categories_code_key" ON "archive_categories"("code");

-- CreateIndex
CREATE INDEX "archive_categories_parentId_idx" ON "archive_categories"("parentId");

-- CreateIndex
CREATE INDEX "archive_categories_code_idx" ON "archive_categories"("code");

-- CreateIndex
CREATE INDEX "borrow_workflow_nodes_workflowId_idx" ON "borrow_workflow_nodes"("workflowId");

-- CreateIndex
CREATE INDEX "borrow_requests_archiveId_idx" ON "borrow_requests"("archiveId");

-- CreateIndex
CREATE INDEX "borrow_requests_applicantId_idx" ON "borrow_requests"("applicantId");

-- CreateIndex
CREATE INDEX "borrow_requests_status_idx" ON "borrow_requests"("status");

-- CreateIndex
CREATE INDEX "borrow_approval_records_requestId_idx" ON "borrow_approval_records"("requestId");

-- CreateIndex
CREATE INDEX "approval_todos_userId_isRead_idx" ON "approval_todos"("userId", "isRead");

-- CreateIndex
CREATE INDEX "approval_todos_referenceId_idx" ON "approval_todos"("referenceId");

-- AddForeignKey
ALTER TABLE "archive_categories" ADD CONSTRAINT "archive_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "archive_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_workflow_nodes" ADD CONSTRAINT "borrow_workflow_nodes_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "borrow_workflow_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_requests" ADD CONSTRAINT "borrow_requests_archiveId_fkey" FOREIGN KEY ("archiveId") REFERENCES "physical_archives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_requests" ADD CONSTRAINT "borrow_requests_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_requests" ADD CONSTRAINT "borrow_requests_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "borrow_workflow_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_approval_records" ADD CONSTRAINT "borrow_approval_records_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "borrow_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrow_approval_records" ADD CONSTRAINT "borrow_approval_records_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_todos" ADD CONSTRAINT "approval_todos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
