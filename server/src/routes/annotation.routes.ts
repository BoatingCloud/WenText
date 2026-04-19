import { Router } from 'express';
import { annotationController } from '../controllers/annotation.controller';
import { authenticate } from '../middleware/auth';

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

// 创建标注
router.post('/', annotationController.create);

// 获取标注列表（按reviewId查询）
router.get('/', annotationController.list);

// 获取统计信息
router.get('/stats', annotationController.getStats);

// 获取单个标注
router.get('/:id', annotationController.getById);

// 更新标注
router.put('/:id', annotationController.update);

// 删除标注
router.delete('/:id', annotationController.delete);

// 解决标注
router.patch('/:id/resolve', annotationController.resolve);

// 忽略标注
router.patch('/:id/ignore', annotationController.ignore);

// 重新激活标注
router.patch('/:id/reactivate', annotationController.reactivate);

// 添加评论
router.post('/:id/comments', annotationController.addComment);

// 删除评论
router.delete('/comments/:commentId', annotationController.deleteComment);

export default router;
