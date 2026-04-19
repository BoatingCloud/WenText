import { getPrisma } from '../config/database.js';
import type { Prisma } from '@prisma/client';

export interface AuditLogQueryOptions {
  page?: number;
  pageSize?: number;
  action?: string;
  module?: string;
  status?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export class AuditLogService {
  static async findAll(options: AuditLogQueryOptions = {}) {
    const prisma = getPrisma();

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditLogWhereInput = {};

    if (options.action) {
      where.action = options.action;
    }

    if (options.module) {
      where.module = options.module;
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.dateFrom || options.dateTo) {
      where.createdAt = {
        ...(options.dateFrom ? { gte: options.dateFrom } : {}),
        ...(options.dateTo ? { lte: options.dateTo } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      total,
      page,
      pageSize,
    };
  }
}
