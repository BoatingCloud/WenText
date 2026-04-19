import axios from 'axios';
import { AIAdapter, AIConfig, AIReviewParams, AIReviewResult } from './base-adapter.js';

export class OpenAIAdapter implements AIAdapter {
  provider = 'openai' as const;

  async reviewDocument(params: AIReviewParams): Promise<AIReviewResult> {
    const { documentType, title, content, config } = params;

    const prompt = this.buildPrompt(documentType, title, content);
    const endpoint = config.apiEndpoint || 'https://api.openai.com/v1';
    const model = config.model || 'gpt-4';

    try {
      const response = await axios.post(
        `${endpoint}/chat/completions`,
        {
          model,
          messages: [
            {
              role: 'system',
              content: '你是一位专业的法律和商务文档审查专家。请仔细审查文档并提供详细的分析报告。',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          response_format: { type: 'json_object' },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          timeout: 60000,
        }
      );

      const resultText = response.data.choices[0].message.content;
      const result = JSON.parse(resultText);

      return {
        reviewedAt: new Date().toISOString(),
        model,
        riskLevel: result.riskLevel || 'MEDIUM',
        riskScore: result.riskScore || 50,
        risks: result.risks || [],
        keyPoints: result.keyPoints || [],
        gaps: result.gaps || [],
        compliance: result.compliance || [],
        summary: result.summary || '',
        recommendations: result.recommendations || [],
      };
    } catch (error: any) {
      throw new Error(`OpenAI API调用失败: ${error.message}`);
    }
  }

  async testConnection(config: AIConfig): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    const endpoint = config.apiEndpoint || 'https://api.openai.com/v1';
    const startTime = Date.now();

    try {
      await axios.post(
        `${endpoint}/chat/completions`,
        {
          model: config.model || 'gpt-4',
          messages: [{ role: 'user', content: '测试连接' }],
          max_tokens: 10,
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
        message: error.response?.data?.error?.message || error.message || '连接失败',
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

1. 风险评估
   - 识别潜在的法律风险、商务风险、财务风险
   - 评估风险等级（LOW/MEDIUM/HIGH/CRITICAL）
   - 给出风险评分（0-100）

2. 关键点提醒
   - 重要条款
   - 金额和日期
   - 权利义务
   - 违约责任

3. 漏洞和缺失项
   - 缺少的必要条款
   - 表述不清晰的地方
   - 可能引起歧义的内容

4. 合规性检查
   - 是否符合相关法律法规
   - 是否符合公司政策

5. 总体建议
   - 修改建议
   - 注意事项

请以JSON格式返回结果，结构如下：
{
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "riskScore": 0-100,
  "risks": [
    {
      "category": "风险类别",
      "severity": "严重程度",
      "description": "风险描述",
      "location": "位置（页码/段落）",
      "suggestion": "建议"
    }
  ],
  "keyPoints": [
    {
      "type": "类型（条款/金额/日期等）",
      "content": "内容",
      "importance": "重要性",
      "note": "备注"
    }
  ],
  "gaps": [
    {
      "type": "类型",
      "description": "描述",
      "impact": "影响",
      "recommendation": "建议"
    }
  ],
  "compliance": [
    {
      "item": "检查项",
      "status": "PASS|FAIL|WARNING",
      "detail": "详情"
    }
  ],
  "summary": "总体评价",
  "recommendations": ["建议1", "建议2"]
}`;
  }
}
