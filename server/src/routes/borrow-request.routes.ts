import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate, validateMultiple } from '../middleware/validate.js';
import { asyncHandler, successResponse, paginatedResponse } from '../utils/response.js';
import { BorrowRequestService } from '../services/borrow-request.service.js';
import {
  createBorrowRequestSchema,
  borrowRequestQuerySchema,
  approveBorrowRequestSchema,
  rejectBorrowRequestSchema,
  idParamSchema,
  paginationSchema,
} from './schemas.js';

const router = Router();

router.use(authenticate);

// 提交借阅申请
router.post(
  '/',
  requirePermission('archive:borrow'),
  validate(createBorrowRequestSchema),
  asyncHandler(async (req, res) => {
    const request = await BorrowRequestService.createRequest({
      ...req.body,
      applicantId: req.user!.id,
    });
    return successResponse(res, request, '借阅申请已提交', 201);
  })
);

// 列表（全部）
router.get(
  '/',
  requirePermission('archive:view'),
  validate(borrowRequestQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as {
      page: number;
      pageSize: number;
      status?: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
      archiveId?: string;
    };
    const result = await BorrowRequestService.findAll({
      ...query,
      viewerId: req.user!.id,
    });
    return paginatedResponse(res, result.requests, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

// 我的待审批
router.get(
  '/my-pending',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const result = await BorrowRequestService.getMyPendingApprovals(req.user!.id, { page, pageSize });
    return paginatedResponse(res, result.requests, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

// 我的申请
router.get(
  '/my-applications',
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const result = await BorrowRequestService.findAll({
      applicantId: req.user!.id,
      page,
      pageSize,
    });
    return paginatedResponse(res, result.requests, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

// 详情
router.get(
  '/:id',
  requirePermission('archive:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const request = await BorrowRequestService.findById(req.params.id, req.user!.id);
    return successResponse(res, request);
  })
);

// 审批通过
router.post(
  '/:id/approve',
  requirePermission('archive:approve'),
  validateMultiple({
    params: idParamSchema,
    body: approveBorrowRequestSchema,
  }),
  asyncHandler(async (req, res) => {
    const request = await BorrowRequestService.approveNode(
      req.params.id,
      req.user!.id,
      req.body.comment,
      req.body.signatureUrl
    );
    return successResponse(res, request, '审批通过');
  })
);

// 审批驳回
router.post(
  '/:id/reject',
  requirePermission('archive:approve'),
  validateMultiple({
    params: idParamSchema,
    body: rejectBorrowRequestSchema,
  }),
  asyncHandler(async (req, res) => {
    const request = await BorrowRequestService.rejectNode(
      req.params.id,
      req.user!.id,
      req.body.comment,
      req.body.signatureUrl
    );
    return successResponse(res, request, '已驳回');
  })
);

// 取消申请
router.post(
  '/:id/cancel',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const request = await BorrowRequestService.cancelRequest(req.params.id, req.user!.id);
    return successResponse(res, request, '申请已取消');
  })
);

export default router;
