import { Router } from 'express';
import { AuditLogService } from '../services/audit-log.service.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, paginatedResponse } from '../utils/response.js';
import { auditLogQuerySchema } from './schemas.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('audit:view', 'system:audit'),
  validate(auditLogQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const {
      page,
      pageSize,
      action,
      module,
      status,
      userId,
      dateFrom,
      dateTo,
    } = req.query as unknown as {
      page: number;
      pageSize: number;
      action?: string;
      module?: string;
      status?: string;
      userId?: string;
      dateFrom?: string;
      dateTo?: string;
    };

    const result = await AuditLogService.findAll({
      page,
      pageSize,
      action,
      module,
      status,
      userId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });

    return paginatedResponse(res, result.logs, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

export default router;
