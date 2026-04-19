import { AIAdapter, AIConfig, AIReviewParams, AIReviewResult } from './base-adapter.js';
import axios from 'axios';

/**
 * 自定义AI适配器
 * 支持兼容OpenAI API格式的自定义端点
 * 优先使用流式请求，失败时回退到非流式
 */
export class CustomAdapter implements AIAdapter {
  provider = 'custom' as const;

  /**
   * 流式请求并收集完整响应
   */
  private async streamRequest(
    url: string,
    body: object,
    headers: Record<string, string>,
    timeout: number
  ): Promise<string> {
    const response = await axios.post(url, { ...body, stream: true }, {
      headers,
      timeout,
      responseType: 'stream',
    });

    return new Promise((resolve, reject) => {
      let fullContent = '';
      let buffer = '';

      response.data.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) fullContent += delta;
          } catch {
            // 忽略解析错误
          }
        }
      });

      response.data.on('end', () => resolve(fullContent));
      response.data.on('error', reject);
    });
  }

  /**
   * 非流式请求
   */
  private async normalRequest(
    url: string,
    body: object,
    headers: Record<string, string>,
    timeout: number
  ): Promise<string> {
    const response = await axios.post(url, { ...body, stream: false }, {
      headers,
      timeout,
    });
    return response.data?.choices?.[0]?.message?.content || '';
  }

  async reviewDocument(params: AIReviewParams): Promise<AIReviewResult> {
    const { documentType, title, content, config } = params;

    if (!config.apiEndpoint) {
      throw new Error('自定义适配器需要配置API端点');
    }

    if (!config.apiKey) {
      throw new Error('API密钥不能为空');
    }

    const model = config.model || 'gpt-3.5-turbo';
    const prompt = this.buildPrompt(documentType, title, content);
    const url = `${config.apiEndpoint}/chat/completions`;
    // 限制 max_tokens 在有效范围内
    const maxTokens = Math.min(Math.max(config.maxTokens || 4000, 1), 8192);
    const body = {
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
      max_tokens: maxTokens,
      temperature: config.temperature,
    };
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    };

    let resultText = '';
    try {
      // 先尝试流式请求
      resultText = await this.streamRequest(url, body, headers, 300000);
    } catch (streamError: any) {
      console.log('Stream request failed, trying normal request:', streamError.message);
      // 流式失败，尝试非流式
      try {
        resultText = await this.normalRequest(url, body, headers, 300000);
      } catch (normalError: any) {
        console.error('AI API Error:', {
          status: normalError.response?.status,
          data: normalError.response?.data,
          message: normalError.message,
        });
        const errMsg = normalError.response?.data?.error?.message ||
                       normalError.response?.data?.message ||
                       normalError.response?.data?.error ||
                       (typeof normalError.response?.data === 'string' ? normalError.response?.data : null) ||
                       normalError.message;
        throw new Error(`自定义AI服务调用失败: ${errMsg}`);
      }
    }

    // 尝试解析JSON结果
    let result: any;
    try {
      // 提取JSON部分（可能包含markdown代码块）
      const jsonMatch = resultText.match(/```json\s*([\s\S]*?)\s*```/) ||
                        resultText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : resultText;
      result = JSON.parse(jsonStr);
    } catch {
      return {
        reviewedAt: new Date().toISOString(),
        model,
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
  }

  async testConnection(config: AIConfig): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    if (!config.apiEndpoint) {
      return { success: false, message: '请配置API端点' };
    }

    if (!config.apiKey) {
      return { success: false, message: 'API密钥不能为空' };
    }

    const startTime = Date.now();

    try {
      const model = config.model || 'gpt-3.5-turbo';

      // 使用非流式请求测试连接（更兼容）
      const response = await axios.post(
        `${config.apiEndpoint}/chat/completions`,
        {
          model,
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 10,
          stream: false,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`,
          },
          timeout: 30000,
        }
      );

      const latency = Date.now() - startTime;

      if (response.data?.choices?.[0]) {
        return { success: true, message: '连接成功', latency };
      }

      return { success: false, message: '连接失败：响应格式不正确' };
    } catch (error: any) {
      const latency = Date.now() - startTime;

      if (error.response) {
        const errData = error.response.data;
        let errMsg = '';
        if (typeof errData === 'string') {
          errMsg = errData;
        } else {
          errMsg = errData?.error?.message || errData?.message || errData?.error_msg || error.response.statusText;
        }
        return { success: false, message: `连接失败: ${errMsg}`, latency };
      }

      if (error.code === 'ECONNABORTED') {
        return { success: false, message: '连接超时', latency };
      }

      return { success: false, message: `连接失败: ${error.message}`, latency };
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
