import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import { logger } from '../config/logger.js';

export class TextExtractionService {
  /**
   * 从文件中提取文本
   * @param filePath 文件路径
   * @param mimeType 文件MIME类型
   * @returns 提取的文本内容
   */
  static async extractText(filePath: string, mimeType?: string): Promise<string> {
    try {
      const ext = path.extname(filePath).toLowerCase();

      // 根据文件扩展名或MIME类型选择提取方法
      if (ext === '.pdf' || mimeType === 'application/pdf') {
        return await this.extractFromPDF(filePath);
      } else if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return await this.extractFromDocx(filePath);
      } else if (ext === '.doc' || mimeType === 'application/msword') {
        // .doc 格式较复杂，mammoth 主要支持 .docx
        logger.warn('Old .doc format is not fully supported, attempting extraction');
        return await this.extractFromDocx(filePath);
      } else if (
        ext === '.xlsx' ||
        ext === '.xls' ||
        mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        mimeType === 'application/vnd.ms-excel'
      ) {
        return await this.extractFromExcel(filePath);
      } else if (ext === '.txt' || mimeType === 'text/plain') {
        return await this.extractFromText(filePath);
      } else {
        throw new Error(`不支持的文件类型: ${ext || mimeType}`);
      }
    } catch (error) {
      logger.error('Text extraction failed:', error);
      throw new Error(`文本提取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 从PDF文件提取文本
   */
  private static async extractFromPDF(filePath: string): Promise<string> {
    try {
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse(dataBuffer);

      if (!data.text || data.text.trim().length === 0) {
        throw new Error('PDF文件中未找到可提取的文本内容');
      }

      return data.text;
    } catch (error) {
      logger.error('PDF extraction failed:', error);
      throw new Error(`PDF文本提取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 从Word文档提取文本
   */
  private static async extractFromDocx(filePath: string): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ path: filePath });

      if (!result.value || result.value.trim().length === 0) {
        throw new Error('Word文档中未找到可提取的文本内容');
      }

      // 记录警告信息（如果有）
      if (result.messages && result.messages.length > 0) {
        result.messages.forEach(msg => {
          if (msg.type === 'warning') {
            logger.warn('Word extraction warning:', msg.message);
          }
        });
      }

      return result.value;
    } catch (error) {
      logger.error('Word extraction failed:', error);
      throw new Error(`Word文本提取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 从Excel文件提取文本
   */
  private static async extractFromExcel(filePath: string): Promise<string> {
    try {
      const workbook = xlsx.readFile(filePath);
      const texts: string[] = [];

      // 遍历所有工作表
      workbook.SheetNames.forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];

        // 添加工作表名称
        texts.push(`\n=== ${sheetName} ===\n`);

        // 将工作表转换为CSV格式文本
        const csv = xlsx.utils.sheet_to_csv(worksheet);
        texts.push(csv);
      });

      const result = texts.join('\n');

      if (!result || result.trim().length === 0) {
        throw new Error('Excel文件中未找到可提取的文本内容');
      }

      return result;
    } catch (error) {
      logger.error('Excel extraction failed:', error);
      throw new Error(`Excel文本提取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 从纯文本文件提取文本
   */
  private static async extractFromText(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (!content || content.trim().length === 0) {
        throw new Error('文本文件为空');
      }

      return content;
    } catch (error) {
      logger.error('Text file reading failed:', error);
      throw new Error(`文本文件读取失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 限制文本长度（用于AI处理）
   * @param text 原始文本
   * @param maxLength 最大长度
   * @returns 截断后的文本
   */
  static truncateText(text: string, maxLength: number = 50000): string {
    if (text.length <= maxLength) {
      return text;
    }

    // 截断并添加提示
    const truncated = text.substring(0, maxLength);
    return `${truncated}\n\n[注意：文档内容过长，已截断。完整文档共 ${text.length} 字符，当前显示前 ${maxLength} 字符]`;
  }

  /**
   * 批量提取多个文件的文本
   * @param files 文件信息数组
   * @returns 提取的文本内容数组
   */
  static async extractMultiple(
    files: Array<{ path: string; mimeType?: string; name: string }>
  ): Promise<Array<{ name: string; text: string; error?: string }>> {
    const results = await Promise.allSettled(
      files.map(async file => {
        try {
          const text = await this.extractText(file.path, file.mimeType);
          return { name: file.name, text };
        } catch (error) {
          return {
            name: file.name,
            text: '',
            error: error instanceof Error ? error.message : '提取失败',
          };
        }
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          name: files[index].name,
          text: '',
          error: result.reason?.message || '提取失败',
        };
      }
    });
  }
}
