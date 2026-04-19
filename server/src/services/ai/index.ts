import { AIAdapter } from './base-adapter.js';
import { OpenAIAdapter } from './openai-adapter.js';
import { WenxinAdapter } from './wenxin-adapter.js';
import { QwenAdapter } from './qwen-adapter.js';
import { CustomAdapter } from './custom-adapter.js';
import { AIProvider } from '../system-config.service.js';

export function createAIAdapter(provider: AIProvider): AIAdapter {
  switch (provider) {
    case 'openai':
      return new OpenAIAdapter();
    case 'wenxin':
      return new WenxinAdapter();
    case 'qwen':
      return new QwenAdapter();
    case 'custom':
      return new CustomAdapter();
    case 'claude':
      // TODO: 实现Claude适配器
      throw new Error('Claude适配器尚未实现');
    case 'spark':
      // TODO: 实现讯飞星火适配器
      throw new Error('讯飞星火适配器尚未实现');
    case 'zhipu':
      // TODO: 实现智谱AI适配器
      throw new Error('智谱AI适配器尚未实现');
    default:
      throw new Error(`不支持的AI提供商: ${provider}`);
  }
}

export * from './base-adapter.js';
export { OpenAIAdapter } from './openai-adapter.js';
export { WenxinAdapter } from './wenxin-adapter.js';
export { QwenAdapter } from './qwen-adapter.js';
export { CustomAdapter } from './custom-adapter.js';
