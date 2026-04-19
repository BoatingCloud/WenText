-- CreateEnum
CREATE TYPE "DocumentReviewType" AS ENUM ('CONTRACT', 'LAWYER_LETTER', 'COLLECTION_LETTER', 'AGREEMENT', 'NOTICE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'AI_REVIEWING', 'PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIReviewStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AnnotationType" AS ENUM ('RISK', 'KEY_POINT', 'GAP', 'COMPLIANCE', 'SUGGESTION');

-- CreateEnum
CREATE TYPE "AnnotationStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'IGNORED');

-- CreateTable
CREATE TABLE "document_reviews" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentType" "DocumentReviewType" NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "departmentId" TEXT,
    "companyCode" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "workflowId" TEXT,
    "currentNodeOrder" INTEGER NOT NULL DEFAULT 1,
    "aiReviewStatus" "AIReviewStatus",
    "aiReviewResult" JSONB,
    "aiReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "document_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_review_attachments" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileExtension" TEXT,
    "fileSize" BIGINT NOT NULL,
    "mimeType" TEXT,
    "storagePath" TEXT NOT NULL,
    "md5" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "extractedText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_review_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_approval_records" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "nodeOrder" INTEGER NOT NULL,
    "nodeName" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "comment" TEXT,
    "signatureUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_workflow_configs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "documentType" "DocumentReviewType",
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_workflow_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_workflow_nodes" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nodeOrder" INTEGER NOT NULL,
    "approverType" TEXT NOT NULL,
    "approverValue" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_workflow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_review_annotations" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "annotatorId" TEXT NOT NULL,
    "annotationType" "AnnotationType" NOT NULL,
    "category" TEXT,
    "severity" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "suggestion" TEXT,
    "status" "AnnotationStatus" NOT NULL DEFAULT 'ACTIVE',
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolveNote" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_review_annotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annotation_comments" (
    "id" TEXT NOT NULL,
    "annotationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "annotation_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_reviews_initiatorId_idx" ON "document_reviews"("initiatorId");

-- CreateIndex
CREATE INDEX "document_reviews_status_idx" ON "document_reviews"("status");

-- CreateIndex
CREATE INDEX "document_reviews_documentType_idx" ON "document_reviews"("documentType");

-- CreateIndex
CREATE INDEX "document_reviews_companyCode_idx" ON "document_reviews"("companyCode");

-- CreateIndex
CREATE INDEX "document_reviews_createdAt_idx" ON "document_reviews"("createdAt");

-- CreateIndex
CREATE INDEX "document_review_attachments_reviewId_idx" ON "document_review_attachments"("reviewId");

-- CreateIndex
CREATE INDEX "review_approval_records_reviewId_idx" ON "review_approval_records"("reviewId");

-- CreateIndex
CREATE INDEX "review_workflow_nodes_workflowId_idx" ON "review_workflow_nodes"("workflowId");

-- CreateIndex
CREATE INDEX "manual_review_annotations_reviewId_idx" ON "manual_review_annotations"("reviewId");

-- CreateIndex
CREATE INDEX "manual_review_annotations_annotatorId_idx" ON "manual_review_annotations"("annotatorId");

-- CreateIndex
CREATE INDEX "manual_review_annotations_status_idx" ON "manual_review_annotations"("status");

-- CreateIndex
CREATE INDEX "annotation_comments_annotationId_idx" ON "annotation_comments"("annotationId");

-- AddForeignKey
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reviews" ADD CONSTRAINT "document_reviews_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "review_workflow_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_review_attachments" ADD CONSTRAINT "document_review_attachments_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "document_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_review_attachments" ADD CONSTRAINT "document_review_attachments_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_approval_records" ADD CONSTRAINT "review_approval_records_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "document_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_approval_records" ADD CONSTRAINT "review_approval_records_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_workflow_nodes" ADD CONSTRAINT "review_workflow_nodes_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "review_workflow_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_review_annotations" ADD CONSTRAINT "manual_review_annotations_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "document_reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_review_annotations" ADD CONSTRAINT "manual_review_annotations_annotatorId_fkey" FOREIGN KEY ("annotatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation_comments" ADD CONSTRAINT "annotation_comments_annotationId_fkey" FOREIGN KEY ("annotationId") REFERENCES "manual_review_annotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annotation_comments" ADD CONSTRAINT "annotation_comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
