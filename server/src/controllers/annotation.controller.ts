import { Request, Response } from 'express';
import { annotationService } from '../services/annotation.service';
import { AnnotationType, AnnotationStatus } from '@prisma/client';

export const annotationController = {
  // 创建标注
  async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const annotation = await annotationService.create(userId, req.body);
      res.json({ success: true, data: annotation });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 获取标注列表
  async list(req: Request, res: Response) {
    try {
      const { reviewId, annotationType, status, priority } = req.query;

      if (!reviewId) {
        return res.status(400).json({ success: false, message: 'reviewId is required' });
      }

      const filters: any = {};
      if (annotationType) filters.annotationType = annotationType as AnnotationType;
      if (status) filters.status = status as AnnotationStatus;
      if (priority !== undefined) filters.priority = parseInt(priority as string);

      const annotations = await annotationService.list(reviewId as string, filters);
      res.json({ success: true, data: annotations });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 获取单个标注
  async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const annotation = await annotationService.getById(id);

      if (!annotation) {
        return res.status(404).json({ success: false, message: 'Annotation not found' });
      }

      res.json({ success: true, data: annotation });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 更新标注
  async update(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const annotation = await annotationService.update(id, req.body);
      res.json({ success: true, data: annotation });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 删除标注
  async delete(req: Request, res: Response) {
    try {
      const { id } = req.params;
      await annotationService.delete(id);
      res.json({ success: true, message: 'Annotation deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 解决标注
  async resolve(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const annotation = await annotationService.resolve(id, userId, req.body);
      res.json({ success: true, data: annotation });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 忽略标注
  async ignore(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const annotation = await annotationService.ignore(id);
      res.json({ success: true, data: annotation });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 重新激活标注
  async reactivate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const annotation = await annotationService.reactivate(id);
      res.json({ success: true, data: annotation });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 添加评论
  async addComment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const userId = (req as any).user.id;
      const comment = await annotationService.addComment(id, userId, req.body);
      res.json({ success: true, data: comment });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 删除评论
  async deleteComment(req: Request, res: Response) {
    try {
      const { commentId } = req.params;
      await annotationService.deleteComment(commentId);
      res.json({ success: true, message: 'Comment deleted' });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  // 获取统计信息
  async getStats(req: Request, res: Response) {
    try {
      const { reviewId } = req.query;

      if (!reviewId) {
        return res.status(400).json({ success: false, message: 'reviewId is required' });
      }

      const stats = await annotationService.getStats(reviewId as string);
      res.json({ success: true, data: stats });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  },
};
