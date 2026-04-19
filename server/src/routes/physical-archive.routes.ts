import { Router } from 'express';
import multer from 'multer';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate, validateMultiple } from '../middleware/validate.js';
import { asyncHandler, successResponse, paginatedResponse } from '../utils/response.js';
import { PhysicalArchiveService } from '../services/physical-archive.service.js';
import { ArchiveAttachmentService } from '../services/archive-attachment.service.js';
import { SystemConfigService } from '../services/system-config.service.js';
import { ValidationError } from '../utils/errors.js';
import {
  createPhysicalArchiveSchema,
  updatePhysicalArchiveSchema,
  physicalArchiveQuerySchema,
  borrowPhysicalArchiveSchema,
  returnPhysicalArchiveSchema,
  submitReviewSchema,
  approveArchiveSchema,
  rejectReviewSchema,
  markModifiedSchema,
  destroyPhysicalArchiveSchema,
  paginationSchema,
  idParamSchema,
} from './schemas.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('archive:view'),
  validate(physicalArchiveQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as {
      page: number;
      pageSize: number;
      search?: string;
      categoryId?: string;
      status?: 'IN_STOCK' | 'BORROWED' | 'LOST' | 'DESTROYED';
      workflowStatus?: 'DRAFT' | 'PENDING_REVIEW' | 'ARCHIVED' | 'MODIFIED' | 'BORROWED' | 'RETURNED' | 'DESTROYED';
      year?: number;
      includeDestroyed?: boolean;
      companyCode?: string;
    };

    const result = await PhysicalArchiveService.findAll({
      ...query,
      userId: req.user!.id,
    });
    return paginatedResponse(res, result.archives, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

router.get(
  '/:id',
  requirePermission('archive:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const archive = await PhysicalArchiveService.findById(req.params.id, req.user!.id);
    return successResponse(res, archive);
  })
);

router.post(
  '/',
  requirePermission('archive:create'),
  validate(createPhysicalArchiveSchema),
  asyncHandler(async (req, res) => {
    const archive = await PhysicalArchiveService.create({
      ...req.body,
      creatorId: req.user!.id,
    });
    return successResponse(res, archive, '实体档案创建成功', 201);
  })
);

router.put(
  '/:id',
  requirePermission('archive:update'),
  validateMultiple({
    params: idParamSchema,
    body: updatePhysicalArchiveSchema,
  }),
  asyncHandler(async (req, res) => {
    const archive = await PhysicalArchiveService.update(req.params.id, req.body, req.user!.id);
    return successResponse(res, archive, '实体档案更新成功');
  })
);

router.delete(
  '/:id',
  requirePermission('archive:delete'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await PhysicalArchiveService.remove(req.params.id, undefined, req.user!.name, req.user!.id);
    return successResponse(res, null, '实体档案删除成功');
  })
);

router.post(
  '/:id/borrow',
  requirePermission('archive:borrow'),
  validateMultiple({
    params: idParamSchema,
    body: borrowPhysicalArchiveSchema,
  }),
  asyncHandler(async (req, res) => {
    const archive = await PhysicalArchiveService.borrow(req.params.id, req.body, req.user!.id);
    return successResponse(res, archive, '实体档案借阅成功');
  })
);

router.post(
  '/:id/return',
  requirePermission('archive:return'),
  validateMultiple({
    params: idParamSchema,
    body: returnPhysicalArchiveSchema,
  }),
  asyncHandler(async (req, res) => {
    const archive = await PhysicalArchiveService.return(req.params.id, req.body, req.user!.id);
    return successResponse(res, archive, '实体档案归还成功');
  })
);

router.get(
  '/:id/borrow-records',
  requirePermission('archive:view'),
  validateMultiple({
    params: idParamSchema,
    query: paginationSchema,
  }),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const result = await PhysicalArchiveService.listBorrowRecords(req.params.id, { page, pageSize });

    return paginatedResponse(res, result.records, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

// ── 工作流动作 API ──────────────────────────────────────────

router.post(
  '/:id/actions/submit-review',
  requirePermission('archive:update'),
  validateMultiple({
    params: idParamSchema,
    body: submitReviewSchema,
  }),
  asyncHandler(async (req, res) => {
    const archive = await PhysicalArchiveService.submitReview(req.params.id, req.body.comment, req.user!.id);
    return successResponse(res, archive, '已提交审核');
  })
);

router.post(
  '/:id/actions/approve-archive',
  requirePermission('archive:approve'),
  validateMultiple({
    params: idParamSchema,
    body: approveArchiveSchema,
  }),
  asyncHandler(async (req, res) => {
    const reviewerName = req.user!.name || req.user!.username;
    const archive = await PhysicalArchiveService.approveArchive(
      req.params.id,
      reviewerName,
      req.body.reviewComment,
      req.user!.id,
    );
    return successResponse(res, archive, '审核通过，已归档');
  })
);

router.post(
  '/:id/actions/reject-review',
  requirePermission('archive:approve'),
  validateMultiple({
    params: idParamSchema,
    body: rejectReviewSchema,
  }),
  asyncHandler(async (req, res) => {
    const reviewerName = req.user!.name || req.user!.username;
    const archive = await PhysicalArchiveService.rejectReviewToDraft(
      req.params.id,
      reviewerName,
      req.body.reviewComment,
      req.user!.id,
    );
    return successResponse(res, archive, '已驳回至草稿');
  })
);

router.post(
  '/:id/actions/mark-modified',
  requirePermission('archive:update'),
  validateMultiple({
    params: idParamSchema,
    body: markModifiedSchema,
  }),
  asyncHandler(async (req, res) => {
    const archive = await PhysicalArchiveService.markModified(req.params.id, req.body.reason, req.user!.id);
    return successResponse(res, archive, '已标记为修改状态');
  })
);

router.post(
  '/:id/actions/destroy',
  requirePermission('archive:delete'),
  validateMultiple({
    params: idParamSchema,
    body: destroyPhysicalArchiveSchema,
  }),
  asyncHandler(async (req, res) => {
    const destroyerName = req.user!.name || req.user!.username;
    const archive = await PhysicalArchiveService.destroy(
      req.params.id,
      destroyerName,
      req.body.destroyReason,
      req.user!.id,
    );
    return successResponse(res, archive, '档案已销毁');
  })
);

// ── 附件 API ──────────────────────────────────────────

const withUploadLimit = () => {
  return asyncHandler(async (req, _res, next) => {
    const limitBytes = await SystemConfigService.getUploadLimitBytes();
    const uploader = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: limitBytes },
    });

    uploader.array('files', 20)(req, _res, (error) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        const limitMB = Math.max(1, Math.round(limitBytes / 1024 / 1024));
        return next(new ValidationError(`上传失败：单文件大小不能超过 ${limitMB}MB`));
      }
      return next(error || undefined);
    });
  });
};

router.get(
  '/:id/attachments',
  requirePermission('archive:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    // 校验用户对该档案所属公司的数据权限
    await PhysicalArchiveService.checkArchiveAccess(req.params.id, req.user!.id);
    const attachments = await ArchiveAttachmentService.list(req.params.id);
    return successResponse(res, attachments);
  })
);

router.post(
  '/:id/attachments',
  requirePermission('archive:update'),
  validate(idParamSchema, 'params'),
  withUploadLimit(),
  asyncHandler(async (req, res) => {
    // 校验用户对该档案所属公司的数据权限
    await PhysicalArchiveService.checkArchiveAccess(req.params.id, req.user!.id);
    const files = (req as any).files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      throw new ValidationError('请选择要上传的文件');
    }

    const attachments = await ArchiveAttachmentService.uploadMultiple(
      req.params.id,
      files.map((f) => ({
        // 修复中文文件名乱码：multer 使用 latin1 编码，需要转换为 UTF-8
        originalname: Buffer.from(f.originalname, 'latin1').toString('utf8'),
        buffer: f.buffer,
        mimetype: f.mimetype,
      })),
      req.user!.id,
    );
    return successResponse(res, attachments, '附件上传成功', 201);
  })
);

router.delete(
  '/:id/attachments/:attachmentId',
  requirePermission('archive:update'),
  asyncHandler(async (req, res) => {
    // 校验用户对该档案所属公司的数据权限
    await PhysicalArchiveService.checkArchiveAccess(req.params.id, req.user!.id);
    await ArchiveAttachmentService.delete(req.params.attachmentId);
    return successResponse(res, null, '附件删除成功');
  })
);

router.get(
  '/:id/attachments/:attachmentId/download',
  requirePermission('archive:view'),
  asyncHandler(async (req, res) => {
    // 校验用户对该档案所属公司的数据权限
    await PhysicalArchiveService.checkArchiveAccess(req.params.id, req.user!.id);
    const info = await ArchiveAttachmentService.getDownloadInfo(req.params.attachmentId);
    res.setHeader('Content-Type', info.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(info.fileName)}`);
    if (info.fileSize) {
      res.setHeader('Content-Length', info.fileSize);
    }
    info.stream.pipe(res);
  })
);

export default router;
