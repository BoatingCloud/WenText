import { getPrisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { createAIAdapter, AIReviewResult } from './ai/index.js';
import { TextExtractionService } from './text-extraction.service.js';
import { SystemConfigService } from './system-config.service.js';

export interface DocumentReviewInput {
  reviewId: string;
  documentType: string;
  title: string;
  attachmentIds: string[];
}

export class AIReviewService {
  /**
   * 执行AI文档审查
   * @param input 审查输入参数
   * @returns AI审查结果
   */
  static async reviewDocument(input: DocumentReviewInput): Promise<AIReviewResult> {
    const { reviewId, documentType, title, attachmentIds } = input;

    try {
      // 1. 获取AI配置
      const aiConfig = await SystemConfigService.getAIConfig();

      if (!aiConfig.enabled) {
        throw new Error('AI功能未启用，请先在系统设置中启用并配置AI服务');
      }

      if (!aiConfig.apiKey) {
        throw new Error('AI服务未配置，请先在系统设置中配置API密钥');
      }

      // 2. 获取附件信息
      const prisma = getPrisma();
      const attachments = await prisma.documentReviewAttachment.findMany({
        where: {
          id: { in: attachmentIds },
          reviewId,
        },
        select: {
          id: true,
          fileName: true,
          storagePath: true,
          mimeType: true,
          extractedText: true,
        },
      });

      if (attachments.length === 0) {
        throw new Error('未找到可审查的附件');
      }

      // 3. 提取文本内容
      const extractedTexts: string[] = [];

      for (const attachment of attachments) {
        // 如果已经提取过文本，直接使用
        if (attachment.extractedText) {
          extractedTexts.push(attachment.extractedText);
          continue;
        }

        // 否则进行文本提取
        try {
          const text = await TextExtractionService.extractText(
            attachment.storagePath,
            attachment.mimeType || undefined
          );

          // 保存提取的文本到数据库
          await prisma.documentReviewAttachment.update({
            where: { id: attachment.id },
            data: { extractedText: text },
          });

          extractedTexts.push(text);
        } catch (error) {
          logger.error(`Failed to extract text from ${attachment.fileName}:`, error);
          throw new Error(`文件 ${attachment.fileName} 文本提取失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      }

      // 4. 合并所有文本
      let combinedText = extractedTexts.join('\n\n--- 下一个文件 ---\n\n');

      // 5. 限制文本长度（避免超过AI模型限制）
      const maxTextLength = Math.min(aiConfig.maxTokens * 3, 100000); // 粗略估算：1 token ≈ 3-4 字符
      combinedText = TextExtractionService.truncateText(combinedText, maxTextLength);

      // 6. 调用AI进行审查
      const adapter = createAIAdapter(aiConfig.provider);

      const result = await adapter.reviewDocument({
        documentType,
        title,
        content: combinedText,
        config: {
          provider: aiConfig.provider,
          apiKey: aiConfig.apiKey,
          apiEndpoint: aiConfig.apiEndpoint,
          model: aiConfig.model,
          maxTokens: aiConfig.maxTokens,
          temperature: aiConfig.temperature,
        },
      });

      // 7. 保存审查结果到数据库
      await prisma.documentReview.update({
        where: { id: reviewId },
        data: {
          aiReviewStatus: 'COMPLETED',
          aiReviewResult: result as any,
          aiReviewedAt: new Date(),
        },
      });

      logger.info(`AI review completed for document review ${reviewId}`);

      return result;
    } catch (error) {
      logger.error('AI review failed:', error);

      // 更新审查状态为失败
      try {
        const prisma = getPrisma();
        await prisma.documentReview.update({
          where: { id: reviewId },
          data: {
            aiReviewStatus: 'FAILED',
            aiReviewResult: {
              error: error instanceof Error ? error.message : '审查失败',
              failedAt: new Date().toISOString(),
            } as any,
          },
        });
      } catch (updateError) {
        logger.error('Failed to update review status:', updateError);
      }

      throw error;
    }
  }

  /**
   * 获取AI审查结果
   * @param reviewId 审查记录ID
   * @returns AI审查结果
   */
  static async getReviewResult(reviewId: string): Promise<AIReviewResult | null> {
    const prisma = getPrisma();

    const review = await prisma.documentReview.findUnique({
      where: { id: reviewId },
      select: {
        aiReviewStatus: true,
        aiReviewResult: true,
        aiReviewedAt: true,
      },
    });

    if (!review || !review.aiReviewResult) {
      return null;
    }

    return review.aiReviewResult as any as AIReviewResult;
  }

  /**
   * 检查AI审查状态
   * @param reviewId 审查记录ID
   * @returns 审查状态
   */
  static async getReviewStatus(reviewId: string): Promise<{
    status: string;
    result?: AIReviewResult;
    error?: string;
  }> {
    const prisma = getPrisma();

    const review = await prisma.documentReview.findUnique({
      where: { id: reviewId },
      select: {
        aiReviewStatus: true,
        aiReviewResult: true,
      },
    });

    if (!review) {
      throw new Error('审查记录不存在');
    }

    const result: any = {
      status: review.aiReviewStatus || 'PENDING',
    };

    if (review.aiReviewStatus === 'COMPLETED' && review.aiReviewResult) {
      result.result = review.aiReviewResult;
    } else if (review.aiReviewStatus === 'FAILED' && review.aiReviewResult) {
      const errorData = review.aiReviewResult as any;
      result.error = errorData.error || '审查失败';
    }

    return result;
  }
}
