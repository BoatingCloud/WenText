import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  HOST: z.string().default('0.0.0.0'),

  DB_TYPE: z.enum(['postgresql', 'mysql', 'mongodb']).default('postgresql'),
  DATABASE_URL: z.string(),
  MONGODB_URL: z.string().optional(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform(Number),
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  UPLOAD_MAX_SIZE: z.string().default('104857600').transform(Number),
  UPLOAD_TEMP_DIR: z.string().default('/tmp/wenyu-uploads'),
  STORAGE_BASE_PATH: z.string().default('/data/wenyu/storage'),
  STORAGE_BACKUP_BASE_PATH: z.string().default('/data/wenyu/storage-backup'),

  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.string().default('9000').transform(Number),
  MINIO_USE_SSL: z.string().default('false').transform((v) => v === 'true'),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().default('wenyu'),

  ELASTICSEARCH_NODE: z.string().optional(),
  ELASTICSEARCH_USERNAME: z.string().optional(),
  ELASTICSEARCH_PASSWORD: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_SECURE: z.string().default('false').transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@wenyu.com'),

  AI_ENABLED: z.string().default('false').transform((v) => v === 'true'),
  AI_PROVIDER: z.enum(['openai', 'anthropic', 'azure']).default('openai'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL: z.string().default('gpt-4'),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  LOG_DIR: z.string().default('/var/log/wenyu'),

  CORS_ORIGIN: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),
  RATE_LIMIT_MAX: z.string().default('300').transform(Number),

  ENCRYPTION_KEY: z.string().min(32),
  ENCRYPTION_ALGORITHM: z.string().default('aes-256-gcm'),

  ONLYOFFICE_ENABLED: z.string().default('true').transform((v) => v === 'true'),
  ONLYOFFICE_URL: z.string().optional(),
  ONLYOFFICE_SERVICE_URL: z.string().optional(),
  ONLYOFFICE_INTERNAL_SERVER_URL: z.string().optional(),
  ONLYOFFICE_JWT_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';

// 辅助函数：构建 Redis URL
export const getRedisUrl = (): string => {
  if (config.REDIS_URL) {
    return config.REDIS_URL;
  }
  const auth = config.REDIS_PASSWORD ? `:${config.REDIS_PASSWORD}@` : '';
  return `redis://${auth}${config.REDIS_HOST}:${config.REDIS_PORT}`;
};

// 辅助函数：获取 Elasticsearch 节点
export const getElasticsearchNode = (): string => {
  return config.ELASTICSEARCH_NODE || 'http://elasticsearch:9200';
};

// 辅助函数：获取 CORS 源
export const getCorsOrigin = (): string | string[] => {
  if (config.CORS_ORIGIN) {
    return config.CORS_ORIGIN.split(',').map(origin => origin.trim());
  }
  // 开发环境默认允许常见端口
  if (isDevelopment) {
    return ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
  }
  // 生产环境需要明确配置
  return [];
};

// 辅助函数：获取 OnlyOffice URL
export const getOnlyOfficeUrl = (): string => {
  return config.ONLYOFFICE_URL || 'http://onlyoffice:80';
};

// 辅助函数：获取 OnlyOffice 服务 URL（用于浏览器访问）
export const getOnlyOfficeServiceUrl = (): string => {
  return config.ONLYOFFICE_SERVICE_URL || getOnlyOfficeUrl();
};

// 辅助函数：获取 OnlyOffice 内部服务器 URL（用于回调）
export const getOnlyOfficeInternalServerUrl = (req?: { protocol: string; get: (header: string) => string | undefined }): string => {
  if (config.ONLYOFFICE_INTERNAL_SERVER_URL) {
    return config.ONLYOFFICE_INTERNAL_SERVER_URL;
  }
  // 如果提供了 request 对象，自动构建 URL
  if (req) {
    const protocol = req.protocol;
    const host = req.get('host');
    if (host) {
      return `${protocol}://${host}`;
    }
  }
  // 默认值（Docker 环境）
  return 'http://server:3000';
};
