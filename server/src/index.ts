import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';

import { config, getCorsOrigin } from './config/index.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { getRedis, closeRedis } from './config/redis.js';
import { globalErrorHandler } from './utils/response.js';
import { CollaborationService } from './services/collaboration.service.js';
import { SearchService } from './services/search.service.js';
import { PermissionService } from './services/role.service.js';
import { SystemConfigService } from './services/system-config.service.js';
import { RepositoryService } from './services/repository.service.js';
import { DepartmentService } from './services/department.service.js';
import { StorageFactory } from './storage-adapters/index.js';
import routes from './routes/index.js';

const app = express();
const server = createServer(app);

app.set('json replacer', (_key: string, value: unknown) => {
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return value;
});

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: getCorsOrigin(),
  credentials: true,
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const limiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});
app.use('/api', limiter);

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

// 静态文件服务（签名图片等）
app.use('/uploads', express.static('uploads'));

app.use('/api', routes);

app.use(globalErrorHandler);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在',
    code: 'NOT_FOUND',
  });
});

async function startServer() {
  try {
    await connectDatabase();
    logger.info('Database connected');

    await getRedis().ping();
    logger.info('Redis connected');

    await PermissionService.initDefaultPermissions();
    logger.info('Default permissions initialized');

    await DepartmentService.ensureDefaultRoots();
    logger.info('Default departments initialized');

    await SystemConfigService.ensureDefaults();
    logger.info('Default system config initialized');

    await RepositoryService.ensureStoragePaths();
    logger.info('Repository storage paths ensured');

    try {
      await SearchService.initIndex();
      logger.info('Elasticsearch index initialized');
    } catch (error) {
      logger.warn('Elasticsearch not available, using simple search');
    }

    CollaborationService.initialize(server);
    logger.info('Collaboration service initialized');

    server.listen(config.PORT, config.HOST, () => {
      logger.info(`Server running at http://${config.HOST}:${config.PORT}`);
      logger.info(`Environment: ${config.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    CollaborationService.shutdown();
    await StorageFactory.disconnectAll();
    await disconnectDatabase();
    await closeRedis();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();
