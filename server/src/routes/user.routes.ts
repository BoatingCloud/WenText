import { Router } from 'express';
import { UserService } from '../services/user.service.js';
import { UserDataPermissionService } from '../services/user-data-permission.service.js';
import { DocumentReviewPermissionService } from '../services/document-review-permission.service.js';
import { validate, validateMultiple } from '../middleware/validate.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, successResponse, paginatedResponse } from '../utils/response.js';
import {
  createUserSchema,
  updateUserSchema,
  paginationSchema,
  idParamSchema,
} from './schemas.js';
import { z } from 'zod';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  requirePermission('user:view'),
  validate(paginationSchema, 'query'),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { search, departmentId, status, roleId, organizationType } = req.query;

    console.log('[UserRoutes] GET /users query params:', req.query);
    console.log('[UserRoutes] departmentId:', departmentId);

    const result = await UserService.findAll({
      page,
      pageSize,
      search: search as string,
      departmentId: departmentId as string,
      status: status as 'ACTIVE' | 'INACTIVE' | 'LOCKED',
      roleId: roleId as string,
      organizationType: organizationType as 'GROUP' | 'COMPANY',
    });

    return paginatedResponse(res, result.users, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / result.pageSize),
    });
  })
);

router.get(
  '/:id',
  requirePermission('user:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const user = await UserService.findById(req.params.id);
    return successResponse(res, user);
  })
);

router.post(
  '/',
  requirePermission('user:create'),
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const user = await UserService.create(req.body);
    return successResponse(res, user, '用户创建成功', 201);
  })
);

router.put(
  '/:id',
  requirePermission('user:update'),
  validateMultiple({
    params: idParamSchema,
    body: updateUserSchema,
  }),
  asyncHandler(async (req, res) => {
    const user = await UserService.update(req.params.id, req.body);
    return successResponse(res, user, '用户更新成功');
  })
);

router.delete(
  '/:id',
  requirePermission('user:delete'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await UserService.delete(req.params.id);
    return successResponse(res, null, '用户删除成功');
  })
);

router.post(
  '/:id/roles',
  requirePermission('user:update'),
  validateMultiple({
    params: idParamSchema,
    body: z.object({ roleIds: z.array(z.string().uuid()) }),
  }),
  asyncHandler(async (req, res) => {
    await UserService.assignRoles(req.params.id, req.body.roleIds);
    return successResponse(res, null, '角色分配成功');
  })
);

router.post(
  '/roles/batch',
  requirePermission('user:update'),
  validate(z.object({
    userIds: z.array(z.string().uuid()).min(1, '至少选择一个用户'),
    roleIds: z.array(z.string().uuid()),
  })),
  asyncHandler(async (req, res) => {
    await UserService.batchAssignRoles(req.body.userIds, req.body.roleIds);
    return successResponse(res, null, '批量角色分配成功');
  })
);

router.patch(
  '/:id/status',
  requirePermission('user:update'),
  validateMultiple({
    params: idParamSchema,
    body: z.object({ status: z.enum(['ACTIVE', 'INACTIVE', 'LOCKED']) }),
  }),
  asyncHandler(async (req, res) => {
    await UserService.updateStatus(req.params.id, req.body.status);
    return successResponse(res, null, '状态更新成功');
  })
);

// 用户公司范围（数据权限）API — 允许用户查看自己的 scopes，管理员可查看任意用户
router.get(
  '/:id/company-scopes',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    if (req.params.id !== req.user!.id && !req.user!.permissions?.includes('user:view')) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    const result = await UserDataPermissionService.getCompanyScopes(req.params.id);
    return successResponse(res, result);
  })
);

router.put(
  '/:id/company-scopes',
  requirePermission('user:update'),
  validateMultiple({
    params: idParamSchema,
    body: z.object({ companyCodes: z.array(z.string()) }),
  }),
  asyncHandler(async (req, res) => {
    await UserDataPermissionService.setCompanyScopes(req.params.id, req.body.companyCodes);
    return successResponse(res, null, '公司权限更新成功');
  })
);

// 用户仓库范围（仓库权限）API — 允许用户查看自己的 scopes
router.get(
  '/:id/repository-scopes',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    if (req.params.id !== req.user!.id && !req.user!.permissions?.includes('user:view')) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    const result = await UserDataPermissionService.getRepositoryScopes(req.params.id);
    return successResponse(res, result);
  })
);

router.put(
  '/:id/repository-scopes',
  requirePermission('user:update'),
  validateMultiple({
    params: idParamSchema,
    body: z.object({ repositoryIds: z.array(z.string().uuid()) }),
  }),
  asyncHandler(async (req, res) => {
    await UserDataPermissionService.setRepositoryScopes(req.params.id, req.body.repositoryIds);
    return successResponse(res, null, '仓库权限更新成功');
  })
);

// 用户实体档案范围（档案权限）API — 允许用户查看自己的 scopes
router.get(
  '/:id/physical-archive-scopes',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    if (req.params.id !== req.user!.id && !req.user!.permissions?.includes('user:view')) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    const result = await UserDataPermissionService.getPhysicalArchiveScopes(req.params.id);
    return successResponse(res, result);
  })
);

router.put(
  '/:id/physical-archive-scopes',
  requirePermission('user:update'),
  validateMultiple({
    params: idParamSchema,
    body: z.object({ physicalArchiveIds: z.array(z.string().uuid()) }),
  }),
  asyncHandler(async (req, res) => {
    await UserDataPermissionService.setPhysicalArchiveScopes(req.params.id, req.body.physicalArchiveIds);
    return successResponse(res, null, '档案权限更新成功');
  })
);

// 用户档案公司范围 API
router.get(
  '/:id/archive-scopes',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    if (req.params.id !== req.user!.id && !req.user!.permissions?.includes('user:view')) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    const result = await UserDataPermissionService.getArchiveCompanyScopes(req.params.id);
    return successResponse(res, result);
  })
);

router.put(
  '/:id/archive-scopes',
  requirePermission('user:update'),
  validateMultiple({
    params: idParamSchema,
    body: z.object({ companyCodes: z.array(z.string()) }),
  }),
  asyncHandler(async (req, res) => {
    await UserDataPermissionService.setArchiveCompanyScopes(req.params.id, req.body.companyCodes);
    return successResponse(res, null, '档案权限更新成功');
  })
);

// 用户文档审查公司范围 API
router.get(
  '/:id/document-review-scopes',
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    if (req.params.id !== req.user!.id && !req.user!.permissions?.includes('user:view')) {
      return res.status(403).json({ success: false, message: '权限不足' });
    }
    const result = await DocumentReviewPermissionService.getCompanyScopes(req.params.id);
    return successResponse(res, result);
  })
);

router.put(
  '/:id/document-review-scopes',
  requirePermission('user:update'),
  validateMultiple({
    params: idParamSchema,
    body: z.object({ companyCodes: z.array(z.string()) }),
  }),
  asyncHandler(async (req, res) => {
    await DocumentReviewPermissionService.setCompanyScopes(req.params.id, req.body.companyCodes);
    return successResponse(res, null, '文档审查权限更新成功');
  })
);

export default router;
