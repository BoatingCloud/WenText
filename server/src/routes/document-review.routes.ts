import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import jwt from 'jsonwebtoken';
import fs from 'fs/promises';
import { DocumentReviewController } from '../controllers/document-review.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler, successResponse } from '../utils/response.js';
import { AuthenticationError, NotFoundError, ValidationError } from '../utils/errors.js';
import { config, getOnlyOfficeUrl, getOnlyOfficeServiceUrl, getOnlyOfficeInternalServerUrl } from '../config/index.js';
import { getPrisma } from '../config/database.js';
import { annotationService } from '../services/annotation.service.js';
import { DocumentReviewService } from '../services/document-review.service.js';
import {
  createDocumentReviewSchema,
  updateDocumentReviewSchema,
} from './schemas.js';

const router = Router();

// OnlyOffice JWT 密钥
const getOnlyOfficeSecret = (): string =>
  config.ONLYOFFICE_JWT_SECRET || process.env.ONLYOFFICE_JWT_SECRET || 'viewmatrix';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/data/storage/document-reviews');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// OnlyOffice 文件类型映射
const getFileTypeInfo = (extension: string): { fileType: string; documentType: string } | null => {
  const ext = extension.toLowerCase().replace('.', '');
  const mapping: Record<string, { fileType: string; documentType: string }> = {
    doc: { fileType: 'doc', documentType: 'word' },
    docx: { fileType: 'docx', documentType: 'word' },
    odt: { fileType: 'odt', documentType: 'word' },
    rtf: { fileType: 'rtf', documentType: 'word' },
    txt: { fileType: 'txt', documentType: 'word' },
    pdf: { fileType: 'pdf', documentType: 'word' },
    xls: { fileType: 'xls', documentType: 'cell' },
    xlsx: { fileType: 'xlsx', documentType: 'cell' },
    ods: { fileType: 'ods', documentType: 'cell' },
    csv: { fileType: 'csv', documentType: 'cell' },
    ppt: { fileType: 'ppt', documentType: 'slide' },
    pptx: { fileType: 'pptx', documentType: 'slide' },
    odp: { fileType: 'odp', documentType: 'slide' },
  };
  return mapping[ext] || null;
};

// ========== OnlyOffice 预览接口（无需认证中间件，使用 token 验证） ==========

// OnlyOffice 获取文件
router.get(
  '/:id/attachments/:attachmentId/onlyoffice/file',
  asyncHandler(async (req, res) => {
    const { id: reviewId, attachmentId } = req.params;
    const token = req.query.token as string;

    if (!token) {
      throw new AuthenticationError('访问令牌缺失');
    }

    try {
      const decoded = jwt.verify(token, getOnlyOfficeSecret()) as any;
      if (decoded.attachmentId !== attachmentId || decoded.reviewId !== reviewId) {
        throw new AuthenticationError('访问令牌无效');
      }
    } catch {
      throw new AuthenticationError('访问令牌验证失败');
    }

    const prisma = getPrisma();
    const attachment = await prisma.documentReviewAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.reviewId !== reviewId) {
      throw new NotFoundError('附件不存在');
    }

    const fileBuffer = await fs.readFile(attachment.storagePath);
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    const encodedName = encodeURIComponent(attachment.fileName);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', fileBuffer.length.toString());
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(fileBuffer);
  })
);

// OnlyOffice 回调（只读模式，不需要回调保存）
router.post(
  '/:id/attachments/:attachmentId/onlyoffice/callback',
  asyncHandler(async (req, res) => {
    // 审查附件为只读模式，不保存编辑
    res.status(200).json({ error: 0 });
  })
);

// ========== 需要认证的路由 ==========
router.use(authenticate);

// 获取 OnlyOffice 配置
router.get(
  '/:id/attachments/:attachmentId/onlyoffice/config',
  requirePermission('doc-review:view', 'doc-review:view-dept', 'doc-review:view-all'),
  asyncHandler(async (req, res) => {
    if (!config.ONLYOFFICE_ENABLED) {
      throw new ValidationError('系统未启用 OnlyOffice 集成');
    }

    const { id: reviewId, attachmentId } = req.params;
    const prisma = getPrisma();

    const attachment = await prisma.documentReviewAttachment.findUnique({
      where: { id: attachmentId },
      include: { review: true },
    });

    if (!attachment || attachment.reviewId !== reviewId) {
      throw new NotFoundError('附件不存在');
    }

    const typeInfo = getFileTypeInfo(attachment.fileExtension || '');
    if (!typeInfo) {
      throw new ValidationError('不支持预览此文件类型');
    }

    const secret = getOnlyOfficeSecret();
    const serverBaseUrl = trimTrailingSlash(getOnlyOfficeInternalServerUrl(req));
    const onlyOfficeBaseUrl = trimTrailingSlash(getOnlyOfficeUrl());

    // 生成访问令牌
    const accessToken = jwt.sign(
      { reviewId, attachmentId, userId: req.user!.id },
      secret,
      { expiresIn: '6h' }
    );

    const documentKey = `review-${attachmentId}-${new Date(attachment.createdAt).getTime()}`.slice(0, 128);

    const editorConfig = {
      type: 'desktop',
      documentType: typeInfo.documentType,
      document: {
        fileType: typeInfo.fileType,
        key: documentKey,
        title: attachment.fileName,
        url: `${serverBaseUrl}/api/document-reviews/${reviewId}/attachments/${attachmentId}/onlyoffice/file?token=${encodeURIComponent(accessToken)}`,
        permissions: {
          edit: false,
          review: false,
          comment: false,
          download: true,
          print: true,
        },
      },
      editorConfig: {
        mode: 'view',
        callbackUrl: `${serverBaseUrl}/api/document-reviews/${reviewId}/attachments/${attachmentId}/onlyoffice/callback?token=${encodeURIComponent(accessToken)}`,
        lang: 'zh-CN',
        user: {
          id: req.user!.id,
          name: req.user!.name || req.user!.username,
        },
        customization: {
          compactHeader: true,
          toolbarNoTabs: true,
        },
      },
    };

    return successResponse(res, {
      attachmentId,
      name: attachment.fileName,
      scriptUrl: `${onlyOfficeBaseUrl}/web-apps/apps/api/documents/api.js`,
      config: editorConfig,
    });
  })
);

// 查询列表（根据用户权限自动过滤）
router.get(
  '/',
  requirePermission('doc-review:view', 'doc-review:view-dept', 'doc-review:view-all'),
  asyncHandler(DocumentReviewController.list)
);

// 获取待我审批的列表（静态路由必须在 /:id 之前）
router.get(
  '/pending-approvals',
  requirePermission('doc-review:approve', 'doc-review:view'),
  asyncHandler(async (req, res) => {
    const data = await DocumentReviewService.getPendingApprovals(req.user!.id);
    return successResponse(res, data);
  })
);

// 获取详情
router.get(
  '/:id',
  requirePermission('doc-review:view', 'doc-review:view-dept', 'doc-review:view-all'),
  asyncHandler(DocumentReviewController.getById)
);

// 创建
router.post(
  '/',
  requirePermission('doc-review:create'),
  validate(createDocumentReviewSchema),
  asyncHandler(DocumentReviewController.create)
);

// 更新
router.put(
  '/:id',
  requirePermission('doc-review:edit-own', 'doc-review:edit'),
  validate(updateDocumentReviewSchema),
  asyncHandler(DocumentReviewController.update)
);

// 删除
router.delete(
  '/:id',
  requirePermission('doc-review:delete-own', 'doc-review:delete'),
  asyncHandler(DocumentReviewController.delete)
);

// AI审查
router.post(
  '/:id/ai-review',
  requirePermission('doc-review:ai-review'),
  asyncHandler(DocumentReviewController.triggerAIReview)
);

// 获取AI审查结果
router.get(
  '/:id/ai-review-result',
  requirePermission('doc-review:view-ai-result', 'doc-review:view'),
  asyncHandler(DocumentReviewController.getAIReviewResult)
);

// 上传附件
router.post(
  '/:id/attachments',
  requirePermission('doc-review:upload-attachment', 'doc-review:create', 'doc-review:edit-own'),
  upload.single('file'),
  asyncHandler(DocumentReviewController.uploadAttachment)
);

// 获取附件列表
router.get(
  '/:id/attachments',
  requirePermission('doc-review:view', 'doc-review:view-dept', 'doc-review:view-all'),
  asyncHandler(DocumentReviewController.getAttachments)
);

// 下载附件
router.get(
  '/:id/attachments/:attachmentId/download',
  requirePermission('doc-review:view', 'doc-review:view-dept', 'doc-review:view-all'),
  asyncHandler(async (req, res) => {
    const { id: reviewId, attachmentId } = req.params;
    const prisma = getPrisma();

    const attachment = await prisma.documentReviewAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.reviewId !== reviewId) {
      throw new NotFoundError('附件不存在');
    }

    const fileBuffer = await fs.readFile(attachment.storagePath);
    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    const encodedName = encodeURIComponent(attachment.fileName);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedName}`);
    res.setHeader('Content-Length', fileBuffer.length.toString());
    res.status(200).send(fileBuffer);
  })
);

// 删除附件
router.delete(
  '/:id/attachments/:attachmentId',
  requirePermission('doc-review:edit-own', 'doc-review:edit'),
  asyncHandler(DocumentReviewController.deleteAttachment)
);

// ========== 批注相关路由 ==========

// 获取批注统计（必须在带参数路由之前）
router.get(
  '/:id/annotations/stats',
  requirePermission('doc-review:view', 'doc-review:view-dept', 'doc-review:view-all'),
  asyncHandler(async (req, res) => {
    const { id: reviewId } = req.params;
    const stats = await annotationService.getStats(reviewId);
    return successResponse(res, stats);
  })
);

// 获取批注列表
router.get(
  '/:id/annotations',
  requirePermission('doc-review:view', 'doc-review:view-dept', 'doc-review:view-all'),
  asyncHandler(async (req, res) => {
    const { id: reviewId } = req.params;
    const { annotationType, status, priority } = req.query;
    const annotations = await annotationService.list(reviewId, {
      annotationType: annotationType as any,
      status: status as any,
      priority: priority ? Number(priority) : undefined,
    });
    return successResponse(res, annotations);
  })
);

// 创建批注
router.post(
  '/:id/annotations',
  requirePermission('doc-review:edit-own', 'doc-review:edit'),
  asyncHandler(async (req, res) => {
    const { id: reviewId } = req.params;
    const { content, attachmentId, ...rest } = req.body;
    const annotation = await annotationService.create(req.user!.id, {
      ...rest,
      reviewId,
      attachmentId,
      title: content?.substring(0, 100) || '批注',
      description: content || '',
    });
    return successResponse(res, annotation, '创建成功', 201);
  })
);

// 更新批注
router.put(
  '/:id/annotations/:annotationId',
  requirePermission('doc-review:edit-own', 'doc-review:edit'),
  asyncHandler(async (req, res) => {
    const { annotationId } = req.params;
    const annotation = await annotationService.update(annotationId, req.body);
    return successResponse(res, annotation);
  })
);

// 删除批注
router.delete(
  '/:id/annotations/:annotationId',
  requirePermission('doc-review:edit-own', 'doc-review:edit'),
  asyncHandler(async (req, res) => {
    const { annotationId } = req.params;
    await annotationService.delete(annotationId);
    return successResponse(res, null, '删除成功');
  })
);

// 解决批注
router.post(
  '/:id/annotations/:annotationId/resolve',
  requirePermission('doc-review:edit-own', 'doc-review:edit'),
  asyncHandler(async (req, res) => {
    const { annotationId } = req.params;
    const annotation = await annotationService.resolve(annotationId, req.user!.id, req.body);
    return successResponse(res, annotation);
  })
);

// 忽略批注
router.post(
  '/:id/annotations/:annotationId/ignore',
  requirePermission('doc-review:edit-own', 'doc-review:edit'),
  asyncHandler(async (req, res) => {
    const { annotationId } = req.params;
    const annotation = await annotationService.ignore(annotationId);
    return successResponse(res, annotation);
  })
);

// 重新激活批注
router.post(
  '/:id/annotations/:annotationId/reactivate',
  requirePermission('doc-review:edit-own', 'doc-review:edit'),
  asyncHandler(async (req, res) => {
    const { annotationId } = req.params;
    const annotation = await annotationService.reactivate(annotationId);
    return successResponse(res, annotation);
  })
);

// 添加批注评论
router.post(
  '/:id/annotations/:annotationId/comments',
  requirePermission('doc-review:view', 'doc-review:view-dept', 'doc-review:view-all'),
  asyncHandler(async (req, res) => {
    const { annotationId } = req.params;
    const comment = await annotationService.addComment(annotationId, req.user!.id, req.body);
    return successResponse(res, comment, '评论成功', 201);
  })
);

// 删除批注评论
router.delete(
  '/:id/annotations/:annotationId/comments/:commentId',
  requirePermission('doc-review:edit-own', 'doc-review:edit'),
  asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    await annotationService.deleteComment(commentId);
    return successResponse(res, null, '删除成功');
  })
);

// ========== 审批工作流路由 ==========

// 提交审批
router.post(
  '/:id/submit',
  requirePermission('doc-review:create', 'doc-review:edit-own'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const result = await DocumentReviewService.submitForApproval(req.user!.id, id);
    return successResponse(res, result, '提交成功');
  })
);

// 审批通过
router.post(
  '/:id/approve',
  requirePermission('doc-review:approve'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comment, signatureUrl } = req.body;
    const result = await DocumentReviewService.approve(req.user!.id, id, comment, signatureUrl);
    return successResponse(res, result, '审批通过');
  })
);

// 审批驳回
router.post(
  '/:id/reject',
  requirePermission('doc-review:approve'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { comment, signatureUrl } = req.body;
    const result = await DocumentReviewService.reject(req.user!.id, id, comment, signatureUrl);
    return successResponse(res, result, '已驳回');
  })
);

export default router;
