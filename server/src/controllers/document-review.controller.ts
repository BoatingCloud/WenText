import type { Request, Response } from 'express';
import { DocumentReviewService } from '../services/document-review.service.js';
import { AIReviewService } from '../services/ai-review.service.js';
import { successResponse, paginatedResponse } from '../utils/response.js';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

export class DocumentReviewController {
  /**
   * 创建文档审查
   */
  static async create(req: Request, res: Response) {
    const userId = req.user!.id;
    const review = await DocumentReviewService.create(userId, req.body);
    return successResponse(res, review, '创建成功', 201);
  }

  /**
   * 获取文档审查列表
   */
  static async list(req: Request, res: Response) {
    const userId = req.user!.id;
    const params = {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      status: req.query.status as any,
      documentType: req.query.documentType as any,
      initiatorId: req.query.initiatorId as string,
      companyCode: req.query.companyCode as string,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
    };

    const result = await DocumentReviewService.list(userId, params);
    const page = params.page || 1;
    const pageSize = params.pageSize || 20;
    return paginatedResponse(res, result.data, {
      page,
      pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / pageSize),
    });
  }

  /**
   * 获取文档审查详情
   */
  static async getById(req: Request, res: Response) {
    const userId = req.user!.id;
    const reviewId = req.params.id;
    const review = await DocumentReviewService.getById(userId, reviewId);
    return successResponse(res, review);
  }

  /**
   * 更新文档审查
   */
  static async update(req: Request, res: Response) {
    const userId = req.user!.id;
    const reviewId = req.params.id;
    const review = await DocumentReviewService.update(userId, reviewId, req.body);
    return successResponse(res, review, '更新成功');
  }

  /**
   * 删除文档审查
   */
  static async delete(req: Request, res: Response) {
    const userId = req.user!.id;
    const reviewId = req.params.id;
    await DocumentReviewService.delete(userId, reviewId);
    return successResponse(res, null, '删除成功');
  }

  /**
   * 触发AI审查
   */
  static async triggerAIReview(req: Request, res: Response) {
    const userId = req.user!.id;
    const reviewId = req.params.id;

    // 获取审查记录和附件
    const review = await DocumentReviewService.getById(userId, reviewId) as any;

    if (!review.attachments || review.attachments.length === 0) {
      return successResponse(res, null, '请先上传附件', 400);
    }

    // 更新状态为审查中
    await DocumentReviewService.updateAIReviewStatus(reviewId, 'PROCESSING');

    // 异步执行AI审查（不阻塞响应）
    AIReviewService.reviewDocument({
      reviewId,
      documentType: review.documentType,
      title: review.title,
      attachmentIds: review.attachments.map((a: any) => a.id),
    }).catch(error => {
      console.error('AI review failed:', error);
    });

    return successResponse(res, { reviewId, status: 'PROCESSING' }, 'AI审查已启动');
  }

  /**
   * 获取AI审查结果
   */
  static async getAIReviewResult(req: Request, res: Response) {
    const userId = req.user!.id;
    const reviewId = req.params.id;

    // 检查权限
    await DocumentReviewService.getById(userId, reviewId);

    // 获取审查状态和结果
    const status = await AIReviewService.getReviewStatus(reviewId);

    return successResponse(res, status);
  }

  /**
   * 上传附件
   */
  static async uploadAttachment(req: Request, res: Response) {
    const userId = req.user!.id;
    const reviewId = req.params.id;

    if (!req.file) {
      return successResponse(res, null, '请选择文件', 400);
    }

    const file = req.file;
    // 解码中文文件名
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const fileExtension = path.extname(decodedName);
    const fileName = decodedName;

    // 计算MD5
    const fileBuffer = await fs.readFile(file.path);
    const md5 = crypto.createHash('md5').update(fileBuffer).digest('hex');

    // 保存附件记录
    const attachment = await DocumentReviewService.uploadAttachment(userId, reviewId, {
      fileName,
      fileExtension,
      fileSize: file.size,
      mimeType: file.mimetype,
      storagePath: file.path,
      md5,
    });

    return successResponse(res, attachment, '上传成功', 201);
  }

  /**
   * 删除附件
   */
  static async deleteAttachment(req: Request, res: Response) {
    const userId = req.user!.id;
    const reviewId = req.params.id;
    const attachmentId = req.params.attachmentId;

    await DocumentReviewService.deleteAttachment(userId, reviewId, attachmentId);

    return successResponse(res, null, '删除成功');
  }

  /**
   * 获取附件列表
   */
  static async getAttachments(req: Request, res: Response) {
    const userId = req.user!.id;
    const reviewId = req.params.id;

    const attachments = await DocumentReviewService.getAttachments(userId, reviewId);

    return successResponse(res, attachments);
  }
}

