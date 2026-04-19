import { Request, Response, NextFunction } from 'express';
import type { Prisma } from '@prisma/client';
import { getPrisma } from '../config/database.js';
import { logger } from '../config/logger.js';

export interface AuditContext {
  action: string;
  module: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

export const auditLog = (context: AuditContext) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();

    res.on('finish', async () => {
      try {
        const prisma = getPrisma();
        const duration = Date.now() - startTime;

        await prisma.auditLog.create({
          data: {
            userId: req.user?.id,
            action: context.action,
            module: context.module,
            resourceType: context.resourceType,
            resourceId: context.resourceId || (req.params.id as string),
            details: {
              ...context.details,
              method: req.method,
              path: req.path,
              query: req.query,
              duration,
              statusCode: res.statusCode,
            } as Prisma.InputJsonValue,
            ip: req.ip || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            status: res.statusCode < 400 ? 'SUCCESS' : 'FAILED',
          },
        });
      } catch (error) {
        logger.error('Failed to create audit log:', error);
      }
    });

    next();
  };
};

export const createAuditLog = async (
  userId: string | undefined,
  action: string,
  module: string,
  options: {
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ip?: string;
    userAgent?: string;
    status?: 'SUCCESS' | 'FAILED';
  } = {}
): Promise<void> => {
  try {
    const prisma = getPrisma();

    await prisma.auditLog.create({
      data: {
        userId,
        action,
        module,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
        details: options.details as Prisma.InputJsonValue | undefined,
        ip: options.ip,
        userAgent: options.userAgent,
        status: options.status || 'SUCCESS',
      },
    });
  } catch (error) {
    logger.error('Failed to create audit log:', error);
  }
};
