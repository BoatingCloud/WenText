import axios from 'axios';
import { AIAdapter, AIConfig, AIReviewParams, AIReviewResult } from './base-adapter.js';

export class QwenAdapter implements AIAdapter {
  provider = 'qwen' as const;

  async reviewDocument(params: AIReviewParams): Promise<AIReviewResult> {
    const { documentType, title, content, config } = params;

    const prompt = this.buildPrompt(documentType, title, content);
    const endpoint = config.apiEndpoint || 'https://dashscope.aliyuncs.com';
    const model = config.model || 'qwen-max';

    try {
      const response = await axios.post(
        `${endpoint}/api/v1/services/aigc/text-generation/generation`,
        {
          model,
          input: {
            messages: [
              {
                role: 'system',
                content: '你是一位专业的法律和商务文档审查专家。',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
          },
          parameters: {
            temperature: config.temperature,
            max_tokens: config.maxTokens,
            result_format: 'message',
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          timeout: 60000,
        }
      );

      const resultText = response.data.output.choices[0].message.content;
      const result = this.parseResult(resultText);

      return {
        reviewedAt: new Date().toISOString(),
        model,
        ...result,
      };
    } catch (error: any) {
      throw new Error(`通义千问API调用失败: ${error.message}`);
    }
  }

  async testConnection(config: AIConfig): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    const endpoint = config.apiEndpoint || 'https://dashscope.aliyuncs.com';
    const startTime = Date.now();

    try {
      await axios.post(
        `${endpoint}/api/v1/services/aigc/text-generation/generation`,
        {
          model: config.model || 'qwen-max',
          input: {
            messages: [{ role: 'user', content: '测试连接' }],
          },
          parameters: {
            max_tokens: 10,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          timeout: 10000,
        }
      );

      const latency = Date.now() - startTime;
      return {
        success: true,
        message: '连接成功',
        latency,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || error.message || '连接失败',
      };
    }
  }

  private buildPrompt(documentType: string, title: string, content: string): string {
    return `请审查以下${documentType}文档，并提供详细的分析报告。

文档类型：${documentType}
文档标题：${title}
文档内容：
${content}

请从以下几个方面进行审查：

1. 风险评估：识别潜在风险并评估等级（LOW/MEDIUM/HIGH/CRITICAL）和评分（0-100）
2. 关键点提醒：重要条款、金额、日期、权利义务等
3. 漏洞和缺失项：缺少的必要条款、表述不清晰的地方
4. 合规性检查：是否符合相关法律法规
5. 总体建议：修改建议和注意事项

请以JSON格式返回结果。`;
  }

  private parseResult(resultText: string): Omit<AIReviewResult, 'reviewedAt' | 'model'> {
    try {
      // 尝试解析JSON
      const jsonMatch = resultText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0]);
        return {
          riskLevel: result.riskLevel || 'MEDIUM',
          riskScore: result.riskScore || 50,
          risks: result.risks || [],
          keyPoints: result.keyPoints || [],
          gaps: result.gaps || [],
          compliance: result.compliance || [],
          summary: result.summary || resultText,
          recommendations: result.recommendations || [],
        };
      }
    } catch (e) {
      // JSON解析失败
    }

    // 如果无法解析JSON，返回默认结构
    return {
      riskLevel: 'MEDIUM',
      riskScore: 50,
      risks: [],
      keyPoints: [],
      gaps: [],
      compliance: [],
      summary: resultText,
      recommendations: [],
    };
  }
}
