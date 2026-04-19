import { Router } from 'express';
import { SearchService } from '../services/search.service.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, successResponse, paginatedResponse } from '../utils/response.js';
import { searchSchema } from './schemas.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('search:basic'),
  validate(searchSchema, 'query'),
  asyncHandler(async (req, res) => {
    const options = {
      query: req.query.query as string,
      repositoryId: req.query.repositoryId as string,
      type: req.query.type as 'file' | 'folder' | 'all',
      extensions: req.query.extensions as string[],
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
      userId: req.user!.id,
      bypassDataScope: req.user!.permissions.includes('search:all'),
    };

    let result;
    try {
      result = await SearchService.search(options);
      if (result.total === 0) {
        result = await SearchService.simpleSearch(options);
      }
    } catch {
      result = await SearchService.simpleSearch(options);
    }

    return paginatedResponse(res, result.documents, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

router.post(
  '/reindex/:repositoryId',
  requirePermission('repo:manage'),
  asyncHandler(async (req, res) => {
    await SearchService.reindexRepository(req.params.repositoryId);
    return successResponse(res, null, '索引重建任务已启动');
  })
);

export default router;
