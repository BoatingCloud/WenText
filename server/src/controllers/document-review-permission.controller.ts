import type { Request, Response } from 'express';
import { DocumentReviewPermissionService } from '../services/document-review-permission.service.js';
import { successResponse } from '../utils/response.js';

export class DocumentReviewPermissionController {
  /**
   * 获取用户的文档审查公司范围
   */
  static async getCompanyScopes(req: Request, res: Response) {
    const userId = req.params.userId;
    const scopes = await DocumentReviewPermissionService.getCompanyScopes(userId);
    return successResponse(res, scopes);
  }

  /**
   * 设置用户的文档审查公司范围
   */
  static async setCompanyScopes(req: Request, res: Response) {
    const userId = req.params.userId;
    const { companyCodes } = req.body;
    await DocumentReviewPermissionService.setCompanyScopes(userId, companyCodes);
    return successResponse(res, null, '设置成功');
  }
}
