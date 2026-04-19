import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, successResponse } from '../utils/response.js';
import statisticsService from '../services/statistics.service.js';
import { PhysicalArchiveStatus } from '@prisma/client';

const router = Router();

// 所有统计路由都需要认证
router.use(authenticate);

// 统计查询参数 schema
const statisticsQuerySchema = z.object({
  companyCode: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  categoryId: z.string().uuid().optional(),
  fondsName: z.string().optional(),
  status: z.enum(['IN_STOCK', 'BORROWED', 'LOST', 'DESTROYED']).optional(),
});

/**
 * 获取档案统计数据
 * 需要 archive:view 或 doc:view 权限之一
 */
router.get(
  '/archives',
  asyncHandler(async (req: Request, res: Response) => {
    // 检查用户是否有查看权限
    const user = (req as any).user;
    const hasArchiveView = user?.permissions?.includes('archive:view');
    const hasDocView = user?.permissions?.includes('doc:view');

    if (!hasArchiveView && !hasDocView) {
      return res.status(403).json({
        success: false,
        message: '没有权限访问统计数据',
      });
    }

    const filters = {
      companyCode: req.query.companyCode as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      categoryId: req.query.categoryId as string | undefined,
      fondsName: req.query.fondsName as string | undefined,
      status: req.query.status as PhysicalArchiveStatus | undefined,
    };

    const statistics = await statisticsService.getArchiveStatistics(filters);
    return successResponse(res, statistics, '档案统计数据获取成功');
  })
);

/**
 * 获取文档统计数据
 */
router.get(
  '/documents',
  asyncHandler(async (req: Request, res: Response) => {
    // 检查用户是否有查看权限
    const user = (req as any).user;
    const hasDocView = user?.permissions?.includes('doc:view');

    if (!hasDocView) {
      return res.status(403).json({
        success: false,
        message: '没有权限访问文档统计数据',
      });
    }

    const filters = {
      companyCode: req.query.companyCode as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const statistics = await statisticsService.getDocumentStatistics(filters);
    return successResponse(res, statistics, '文档统计数据获取成功');
  })
);

/**
 * 获取借阅统计数据
 */
router.get(
  '/borrows',
  asyncHandler(async (req: Request, res: Response) => {
    // 检查用户是否有查看权限
    const user = (req as any).user;
    const hasArchiveView = user?.permissions?.includes('archive:view');

    if (!hasArchiveView) {
      return res.status(403).json({
        success: false,
        message: '没有权限访问借阅统计数据',
      });
    }

    const filters = {
      companyCode: req.query.companyCode as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const statistics = await statisticsService.getBorrowStatistics(filters);
    return successResponse(res, statistics, '借阅统计数据获取成功');
  })
);

export default router;
