import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate, validateMultiple } from '../middleware/validate.js';
import { asyncHandler, successResponse } from '../utils/response.js';
import { ArchiveCategoryService } from '../services/archive-category.service.js';
import {
  createArchiveCategorySchema,
  updateArchiveCategorySchema,
  idParamSchema,
} from './schemas.js';

const router = Router();

router.use(authenticate);

// 获取列表（支持 tree=true 返回树形）
router.get(
  '/',
  requirePermission('archive:view'),
  asyncHandler(async (req, res) => {
    if (req.query.tree === 'true') {
      const tree = await ArchiveCategoryService.getTree();
      return successResponse(res, tree);
    }
    const categories = await ArchiveCategoryService.findAll();
    return successResponse(res, categories);
  })
);

// 获取单个
router.get(
  '/:id',
  requirePermission('archive:view'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    const category = await ArchiveCategoryService.findById(req.params.id);
    return successResponse(res, category);
  })
);

// 新建
router.post(
  '/',
  requirePermission('system:manage'),
  validate(createArchiveCategorySchema),
  asyncHandler(async (req, res) => {
    const category = await ArchiveCategoryService.create(req.body);
    return successResponse(res, category, '档案分类创建成功', 201);
  })
);

// 更新
router.put(
  '/:id',
  requirePermission('system:manage'),
  validateMultiple({
    params: idParamSchema,
    body: updateArchiveCategorySchema,
  }),
  asyncHandler(async (req, res) => {
    const category = await ArchiveCategoryService.update(req.params.id, req.body);
    return successResponse(res, category, '档案分类更新成功');
  })
);

// 删除
router.delete(
  '/:id',
  requirePermission('system:manage'),
  validate(idParamSchema, 'params'),
  asyncHandler(async (req, res) => {
    await ArchiveCategoryService.remove(req.params.id);
    return successResponse(res, null, '档案分类删除成功');
  })
);

export default router;
