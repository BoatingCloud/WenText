import { Router } from 'express';
import { ReviewWorkflowController } from '../controllers/review-workflow.controller.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler } from '../utils/response.js';

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

// 获取默认工作流（不需要特殊权限）
router.get(
  '/default',
  asyncHandler(ReviewWorkflowController.getDefault)
);

// 查询列表
router.get(
  '/',
  requirePermission('doc-review:workflow-view', 'system:manage'),
  asyncHandler(ReviewWorkflowController.list)
);

// 获取详情
router.get(
  '/:id',
  requirePermission('doc-review:workflow-view', 'system:manage'),
  asyncHandler(ReviewWorkflowController.getById)
);

// 创建
router.post(
  '/',
  requirePermission('doc-review:workflow-create', 'system:manage'),
  asyncHandler(ReviewWorkflowController.create)
);

// 更新
router.put(
  '/:id',
  requirePermission('doc-review:workflow-edit', 'system:manage'),
  asyncHandler(ReviewWorkflowController.update)
);

// 删除
router.delete(
  '/:id',
  requirePermission('doc-review:workflow-delete', 'system:manage'),
  asyncHandler(ReviewWorkflowController.delete)
);

// 启用/禁用
router.patch(
  '/:id/toggle',
  requirePermission('doc-review:workflow-enable', 'system:manage'),
  asyncHandler(ReviewWorkflowController.toggleEnabled)
);

// 设置为默认
router.patch(
  '/:id/set-default',
  requirePermission('doc-review:workflow-edit', 'system:manage'),
  asyncHandler(ReviewWorkflowController.setDefault)
);

export default router;
