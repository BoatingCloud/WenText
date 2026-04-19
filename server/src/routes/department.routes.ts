import { Router } from 'express';
import { DepartmentService } from '../services/department.service.js';
import { validate, validateMultiple } from '../middleware/validate.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, successResponse } from '../utils/response.js';
import { createDepartmentSchema, updateDepartmentSchema, reorderDepartmentSchema, idParamSchema } from './schemas.js';

const router = Router();

router.use(authenticate);

router.get(
  '/tree',
  requirePermission('user:view'),
  asyncHandler(async (_req, res) => {
    const tree = await DepartmentService.getTree();
    return successResponse(res, tree);
  })
);

router.post(
  '/',
  requirePermission('user:update'),
  validate(createDepartmentSchema),
  asyncHandler(async (req, res) => {
    const department = await DepartmentService.create(req.body);
    return successResponse(res, department, '部门创建成功', 201);
  })
);

router.put(
  '/:id',
  requirePermission('user:update'),
  validateMultiple({
    params: idParamSchema,
    body: updateDepartmentSchema,
  }),
  asyncHandler(async (req, res) => {
    const department = await DepartmentService.update(req.params.id, req.body);
    return successResponse(res, department, '部门更新成功');
  })
);

router.delete(
  '/:id',
  requirePermission('user:update'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await DepartmentService.delete(req.params.id);
    return successResponse(res, null, '部门删除成功');
  })
);

router.patch(
  '/reorder',
  requirePermission('user:update'),
  validate(reorderDepartmentSchema),
  asyncHandler(async (req, res) => {
    await DepartmentService.reorder(req.body.id, req.body.parentId, req.body.index);
    return successResponse(res, null, '组织调整成功');
  })
);

export default router;
