import type { Request, Response } from 'express';
import { ReviewWorkflowService } from '../services/review-workflow.service.js';
import { successResponse, paginatedResponse } from '../utils/response.js';

export class ReviewWorkflowController {
  /**
   * 创建工作流
   */
  static async create(req: Request, res: Response) {
    const workflow = await ReviewWorkflowService.create(req.body);
    return successResponse(res, workflow, '创建成功', 201);
  }

  /**
   * 获取工作流列表
   */
  static async list(req: Request, res: Response) {
    const params = {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
      documentType: req.query.documentType as string,
      isEnabled: req.query.isEnabled === 'true' ? true : req.query.isEnabled === 'false' ? false : undefined,
    };

    const result = await ReviewWorkflowService.list(params);
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
   * 获取工作流详情
   */
  static async getById(req: Request, res: Response) {
    const workflow = await ReviewWorkflowService.getById(req.params.id);
    return successResponse(res, workflow);
  }

  /**
   * 更新工作流
   */
  static async update(req: Request, res: Response) {
    const workflow = await ReviewWorkflowService.update(req.params.id, req.body);
    return successResponse(res, workflow, '更新成功');
  }

  /**
   * 删除工作流
   */
  static async delete(req: Request, res: Response) {
    await ReviewWorkflowService.delete(req.params.id);
    return successResponse(res, null, '删除成功');
  }

  /**
   * 启用/禁用工作流
   */
  static async toggleEnabled(req: Request, res: Response) {
    const { isEnabled } = req.body;
    const workflow = await ReviewWorkflowService.toggleEnabled(req.params.id, isEnabled);
    return successResponse(res, workflow, isEnabled ? '已启用' : '已禁用');
  }

  /**
   * 设置为默认工作流
   */
  static async setDefault(req: Request, res: Response) {
    const workflow = await ReviewWorkflowService.setDefault(req.params.id);
    return successResponse(res, workflow, '已设置为默认工作流');
  }

  /**
   * 获取默认工作流
   */
  static async getDefault(req: Request, res: Response) {
    const documentType = req.query.documentType as string;
    const workflow = await ReviewWorkflowService.getDefault(documentType);
    return successResponse(res, workflow);
  }
}
