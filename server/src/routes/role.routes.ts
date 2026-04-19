import { Router } from 'express';
import { RoleService, PermissionService } from '../services/role.service.js';
import { validate, validateMultiple } from '../middleware/validate.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, successResponse, paginatedResponse } from '../utils/response.js';
import {
  createRoleSchema,
  updateRoleSchema,
  updateRoleUsersSchema,
  updateRoleRepositoryPermissionsSchema,
  updateRoleArchivePermissionsSchema,
  paginationSchema,
  idParamSchema,
} from './schemas.js';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('role:view'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { search } = req.query;

    const result = await RoleService.findAll({
      page,
      pageSize,
      search: search as string,
    });

    return paginatedResponse(res, result.roles, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

router.get(
  '/permissions',
  requirePermission('role:view'),
  asyncHandler(async (req, res) => {
    const { module } = req.query;
    const permissions = await PermissionService.findAll({
      module: module as string,
    });
    return successResponse(res, permissions);
  })
);

router.get(
  '/permissions/modules',
  requirePermission('role:view'),
  asyncHandler(async (req, res) => {
    const modules = await PermissionService.getModules();
    return successResponse(res, modules);
  })
);

router.get(
  '/:id',
  requirePermission('role:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const role = await RoleService.findById(req.params.id);
    return successResponse(res, role);
  })
);

router.get(
  '/:id/users',
  requirePermission('role:view', 'user:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const users = await RoleService.getUsers(req.params.id);
    return successResponse(res, users);
  })
);

router.post(
  '/',
  requirePermission('role:manage'),
  validate(createRoleSchema),
  asyncHandler(async (req, res) => {
    const role = await RoleService.create(req.body);
    return successResponse(res, role, '角色创建成功', 201);
  })
);

router.put(
  '/:id/users',
  requirePermission('role:manage', 'user:update'),
  validateMultiple({
    params: idParamSchema,
    body: updateRoleUsersSchema,
  }),
  asyncHandler(async (req, res) => {
    await RoleService.setUsers(req.params.id, req.body.userIds);
    return successResponse(res, null, '角色用户配置成功');
  })
);

router.put(
  '/:id',
  requirePermission('role:manage'),
  validateMultiple({
    params: idParamSchema,
    body: updateRoleSchema,
  }),
  asyncHandler(async (req, res) => {
    const role = await RoleService.update(req.params.id, req.body);
    return successResponse(res, role, '角色更新成功');
  })
);

router.delete(
  '/:id',
  requirePermission('role:manage'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await RoleService.delete(req.params.id);
    return successResponse(res, null, '角色删除成功');
  })
);

router.get(
  '/:id/repositories',
  requirePermission('role:view', 'repo:manage'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const result = await RoleService.getRepositoryPermissions(req.params.id);
    return successResponse(res, result);
  })
);

router.put(
  '/:id/repositories',
  requirePermission('role:manage', 'repo:manage'),
  validateMultiple({
    params: idParamSchema,
    body: updateRoleRepositoryPermissionsSchema,
  }),
  asyncHandler(async (req, res) => {
    await RoleService.setRepositoryPermissions(req.params.id, req.body.entries);
    return successResponse(res, null, '角色仓库权限更新成功');
  })
);

router.get(
  '/:id/archives',
  requirePermission('role:view', 'archive:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const result = await RoleService.getArchivePermissions(req.params.id);
    return successResponse(res, result);
  })
);

router.put(
  '/:id/archives',
  requirePermission('role:manage', 'archive:manage'),
  validateMultiple({
    params: idParamSchema,
    body: updateRoleArchivePermissionsSchema,
  }),
  asyncHandler(async (req, res) => {
    await RoleService.setArchivePermissions(req.params.id, req.body.entries);
    return successResponse(res, null, '角色档案权限更新成功');
  })
);

export default router;
