import { AIProvider } from '../system-config.service.js';

// AI审查结果接口
export interface AIReviewResult {
  // 基本信息
  reviewedAt: string;
  model: string;

  // 风险评估
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  riskScore: number; // 0-100

  // 风险点
  risks: Array<{
    category: string;
    severity: string;
    description: string;
    location: string;
    suggestion: string;
  }>;

  // 关键点
  keyPoints: Array<{
    type: string;
    content: string;
    importance: string;
    note: string;
  }>;

  // 漏洞和缺失项
  gaps: Array<{
    type: string;
    description: string;
    impact: string;
    recommendation: string;
  }>;

  // 合规性检查
  compliance: Array<{
    item: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    detail: string;
  }>;

  // 总体建议
  summary: string;
  recommendations: string[];
}

// AI配置接口
export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  apiEndpoint?: string;
  model?: string;
  maxTokens: number;
  temperature: number;
}

// AI审查参数
export interface AIReviewParams {
  documentType: string;
  title: string;
  content: string;
  config: AIConfig;
}

// AI适配器基类接口
export interface AIAdapter {
  provider: AIProvider;

  // 调用AI进行文档审查
  reviewDocument(params: AIReviewParams): Promise<AIReviewResult>;

  // 测试连接
  testConnection(config: AIConfig): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }>;
}
