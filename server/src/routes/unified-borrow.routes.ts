import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate, validateMultiple } from '../middleware/validate.js';
import { asyncHandler, successResponse, paginatedResponse } from '../utils/response.js';
import { PhysicalArchiveService } from '../services/physical-archive.service.js';
import { BorrowRequestService } from '../services/borrow-request.service.js';
import { SystemConfigService } from '../services/system-config.service.js';
import {
  borrowPhysicalArchiveSchema,
  returnPhysicalArchiveSchema,
  createBorrowRequestSchema,
  idParamSchema,
} from './schemas.js';

const router = Router();

router.use(authenticate);

/**
 * 统一借阅接口
 * 根据系统配置的借阅模式自动路由：
 * - direct: 直接借阅
 * - workflow: 提交审批申请
 */
router.post(
  '/:id/borrow-unified',
  requirePermission('archive:borrow'),
  validateMultiple({
    params: idParamSchema,
    body: borrowPhysicalArchiveSchema,
  }),
  asyncHandler(async (req, res) => {
    // 获取系统配置
    const settings = await SystemConfigService.getSiteSettings();
    const borrowMode = settings.archiveBorrowMode || 'direct';

    if (borrowMode === 'direct') {
      // 直接借阅模式
      const archive = await PhysicalArchiveService.borrow(
        req.params.id,
        req.body,
        req.user!.id
      );
      return successResponse(res, archive, '实体档案借阅成功');
    } else {
      // 审批流程模式
      // 将借阅请求转换为借阅申请
      const borrowRequest = await BorrowRequestService.createRequest({
        archiveId: req.params.id,
        applicantId: req.user!.id,
        borrowReason: req.body.remark,
        expectedBorrowAt: req.body.borrowedAt ? new Date(req.body.borrowedAt) : undefined,
        expectedReturnAt: req.body.dueAt ? new Date(req.body.dueAt) : undefined,
      });
      return successResponse(res, borrowRequest, '借阅申请已提交，等待审批', 201);
    }
  })
);

/**
 * 统一归还接口
 * 直接调用归还API（两种模式都使用相同的归还逻辑）
 */
router.post(
  '/:id/return-unified',
  requirePermission('archive:return'),
  validateMultiple({
    params: idParamSchema,
    body: returnPhysicalArchiveSchema,
  }),
  asyncHandler(async (req, res) => {
    const archive = await PhysicalArchiveService.return(
      req.params.id,
      req.body,
      req.user!.id
    );
    return successResponse(res, archive, '实体档案归还成功');
  })
);

/**
 * 获取当前借阅模式
 */
router.get(
  '/borrow-mode',
  asyncHandler(async (req, res) => {
    const settings = await SystemConfigService.getSiteSettings();
    return successResponse(res, {
      mode: settings.archiveBorrowMode || 'direct',
      modeLabel: settings.archiveBorrowMode === 'workflow' ? '审批流程' : '直接借阅',
    }, '借阅模式获取成功');
  })
);

/**
 * 获取借阅中的档案列表
 */
router.get(
  '/borrowed-archives',
  requirePermission('archive:view'),
  asyncHandler(async (req, res) => {
    const result = await PhysicalArchiveService.findAll({
      status: 'BORROWED',
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
      search: req.query.search as string | undefined,
      userId: req.user!.id,
    });

    return paginatedResponse(
      res,
      result.archives,
      {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / result.pageSize),
      },
      '获取借阅列表成功'
    );
  })
);

export default router;
