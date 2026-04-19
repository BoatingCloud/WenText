import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate, validateMultiple } from '../middleware/validate.js';
import { asyncHandler, successResponse } from '../utils/response.js';
import { BorrowWorkflowService } from '../services/borrow-workflow.service.js';
import {
  createBorrowWorkflowSchema,
  updateBorrowWorkflowSchema,
  idParamSchema,
} from './schemas.js';

const router = Router();

router.use(authenticate);

// 获取列表
router.get(
  '/',
  requirePermission('archive:view'),
  asyncHandler(async (_req, res) => {
    const workflows = await BorrowWorkflowService.findAll();
    return successResponse(res, workflows);
  })
);

// 获取单个
router.get(
  '/:id',
  requirePermission('archive:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const workflow = await BorrowWorkflowService.findById(req.params.id);
    return successResponse(res, workflow);
  })
);

// 新建
router.post(
  '/',
  requirePermission('system:manage'),
  validate(createBorrowWorkflowSchema),
  asyncHandler(async (req, res) => {
    const workflow = await BorrowWorkflowService.create(req.body);
    return successResponse(res, workflow, '借阅工作流创建成功', 201);
  })
);

// 更新（含节点）
router.put(
  '/:id',
  requirePermission('system:manage'),
  validateMultiple({
    params: idParamSchema,
    body: updateBorrowWorkflowSchema,
  }),
  asyncHandler(async (req, res) => {
    const workflow = await BorrowWorkflowService.update(req.params.id, req.body);
    return successResponse(res, workflow, '借阅工作流更新成功');
  })
);

// 删除
router.delete(
  '/:id',
  requirePermission('system:manage'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await BorrowWorkflowService.remove(req.params.id);
    return successResponse(res, null, '借阅工作流删除成功');
  })
);

export default router;
