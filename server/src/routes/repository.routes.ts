import { Router } from 'express';
import { RepositoryService } from '../services/repository.service.js';
import { validate, validateMultiple } from '../middleware/validate.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, successResponse, paginatedResponse } from '../utils/response.js';
import {
  createRepositorySchema,
  updateRepositorySchema,
  repoPermissionSchema,
  paginationSchema,
  idParamSchema,
} from './schemas.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('repo:view'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { search, storageType, status } = req.query;

    const result = await RepositoryService.findAll({
      page,
      pageSize,
      search: search as string,
      storageType: storageType as any,
      status: status as any,
      userId: req.user!.id,
    });

    return paginatedResponse(res, result.repositories, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

router.get(
  '/accessible',
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const roleIds = user.roles.map((r) => r.id);
    const repos = await RepositoryService.findAccessible(
      user.id,
      roleIds,
      user.departmentId ?? undefined
    );
    return successResponse(res, repos);
  })
);

router.get(
  '/:id',
  requirePermission('repo:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const repo = await RepositoryService.findById(req.params.id);
    return successResponse(res, repo);
  })
);

router.post(
  '/',
  requirePermission('repo:create'),
  validate(createRepositorySchema),
  asyncHandler(async (req, res) => {
    const repo = await RepositoryService.create(req.body);
    return successResponse(res, repo, '仓库创建成功', 201);
  })
);

router.put(
  '/:id',
  requirePermission('repo:manage'),
  validateMultiple({
    params: idParamSchema,
    body: updateRepositorySchema,
  }),
  asyncHandler(async (req, res) => {
    const repo = await RepositoryService.update(req.params.id, req.body);
    return successResponse(res, repo, '仓库更新成功');
  })
);

router.delete(
  '/:id',
  requirePermission('repo:manage'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const permanent = req.query.permanent === 'true';
    await RepositoryService.delete(req.params.id, permanent);
    return successResponse(res, null, '仓库删除成功');
  })
);

router.post(
  '/:id/permissions',
  requirePermission('repo:manage'),
  validateMultiple({
    params: idParamSchema,
    body: repoPermissionSchema,
  }),
  asyncHandler(async (req, res) => {
    await RepositoryService.setPermissions(req.params.id, req.body.permissions);
    return successResponse(res, null, '权限设置成功');
  })
);

export default router;
