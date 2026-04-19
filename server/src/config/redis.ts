import Redis from 'ioredis';
import { getRedisUrl, config } from './index.js';
import { logger } from './logger.js';

let redis: Redis | null = null;

export const getRedis = (): Redis => {
  if (!redis) {
    redis = new Redis(getRedisUrl(), {
      password: config.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('connect', () => {
      logger.info('Redis connected');
    });

    redis.on('error', (error) => {
      logger.error('Redis error:', error);
    });

    redis.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }
  return redis;
};

export const closeRedis = async (): Promise<void> => {
  if (redis) {
    await redis.quit();
    redis = null;
  }
};

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  const data = await getRedis().get(key);
  return data ? JSON.parse(data) : null;
};

export const cacheSet = async <T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> => {
  const data = JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? Number(v) : v));
  if (ttlSeconds) {
    await getRedis().setex(key, ttlSeconds, data);
  } else {
    await getRedis().set(key, data);
  }
};

export const cacheDel = async (key: string): Promise<void> => {
  await getRedis().del(key);
};

export const cacheDelPattern = async (pattern: string): Promise<void> => {
  const keys = await getRedis().keys(pattern);
  if (keys.length > 0) {
    await getRedis().del(...keys);
  }
};
