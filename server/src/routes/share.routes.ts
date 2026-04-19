import { Router } from 'express';
import { ShareService } from '../services/share.service.js';
import { DocumentService } from '../services/document.service.js';
import { validate, validateMultiple } from '../middleware/validate.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { asyncHandler, successResponse, paginatedResponse } from '../utils/response.js';
import {
  createShareSchema,
  accessShareSchema,
  paginationSchema,
  idParamSchema,
} from './schemas.js';
import { z } from 'zod';

const router = Router();

router.get(
  '/access/:code',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const share = await ShareService.findByCode(req.params.code);

    if (!share) {
      return successResponse(res, null, '分享不存在');
    }

    if (share.shareType === 'PASSWORD' && !req.query.hasPassword) {
      return successResponse(res, {
        needPassword: true,
        shareType: share.shareType,
      });
    }

    const password = req.query.password as string | undefined;
    const result = await ShareService.access(req.params.code, password);

    return successResponse(res, result);
  })
);

router.post(
  '/access/:code',
  optionalAuth,
  validate(accessShareSchema),
  asyncHandler(async (req, res) => {
    const result = await ShareService.access(req.params.code, req.body.password);
    return successResponse(res, result);
  })
);

router.get(
  '/access/:code/download',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const password = req.query.password as string | undefined;
    const result = await ShareService.access(req.params.code, password);

    if (!ShareService.checkPermission(result.share, 'download')) {
      return res.status(403).json({
        success: false,
        message: '无下载权限',
      });
    }

    const { stream, document } = await DocumentService.download(result.document.id);

    await ShareService.incrementDownload(result.share.id);

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    const encodedName = encodeURIComponent(document.name);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodedName}`
    );
    res.setHeader('Content-Length', document.size.toString());

    stream.pipe(res);
  })
);

router.use(authenticate);

router.get(
  '/',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { documentId, status } = req.query;

    const result = await ShareService.findAll({
      page,
      pageSize,
      creatorId: req.user!.id,
      documentId: documentId as string,
      status: status as any,
    });

    return paginatedResponse(res, result.shares, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const share = await ShareService.findById(req.params.id);
    return successResponse(res, share);
  })
);

router.post(
  '/document/:documentId',
  validateMultiple({
    params: z.object({ documentId: z.string().uuid() }),
    body: createShareSchema,
  }),
  asyncHandler(async (req, res) => {
    const share = await ShareService.create({
      documentId: req.params.documentId,
      creatorId: req.user!.id,
      ...req.body,
    });
    return successResponse(res, share, '分享创建成功', 201);
  })
);

router.post(
  '/:id/disable',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await ShareService.disable(req.params.id, req.user!.id);
    return successResponse(res, null, '分享已禁用');
  })
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await ShareService.delete(req.params.id, req.user!.id);
    return successResponse(res, null, '分享已删除');
  })
);

export default router;
