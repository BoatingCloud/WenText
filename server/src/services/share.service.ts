import bcrypt from 'bcryptjs';
import { getPrisma } from '../config/database.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../utils/errors.js';
import { asInputJsonArray, toJsonStringArray } from '../utils/json-array.js';
import type { Share, ShareType, ShareStatus, Prisma } from '@prisma/client';

type ShareRecord = Omit<Share, 'permissions'> & { permissions: string[] };

export interface CreateShareInput {
  documentId: string;
  creatorId: string;
  shareType: ShareType;
  password?: string;
  permissions: string[];
  expiresAt?: Date;
  maxViews?: number;
}

export interface ShareQueryOptions {
  page?: number;
  pageSize?: number;
  creatorId?: string;
  documentId?: string;
  status?: ShareStatus;
}

export interface ShareAccessResult {
  share: ShareRecord;
  document: {
    id: string;
    name: string;
    path: string;
    type: string;
    size: bigint;
    mimeType: string | null;
  };
}

export class ShareService {
  private static readonly CODE_LENGTH = 8;
  private static readonly SALT_ROUNDS = 10;

  static async create(input: CreateShareInput): Promise<ShareRecord> {
    const prisma = getPrisma();

    const document = await prisma.document.findUnique({
      where: { id: input.documentId },
    });

    if (!document) {
      throw new NotFoundError('文档');
    }

    let code = '';
    for (let i = 0; i < 6; i++) {
      const candidate = this.generateCode();
      const existing = await prisma.share.findUnique({ where: { code: candidate } });
      if (!existing) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      throw new ValidationError('分享链接生成失败，请重试');
    }

    let hashedPassword: string | undefined;
    if (input.shareType === 'PASSWORD' && input.password) {
      hashedPassword = await bcrypt.hash(input.password, this.SALT_ROUNDS);
    }

    const share = await prisma.share.create({
      data: {
        code,
        documentId: input.documentId,
        creatorId: input.creatorId,
        shareType: input.shareType,
        password: hashedPassword,
        permissions: asInputJsonArray(input.permissions),
        expiresAt: input.expiresAt,
        maxViews: input.maxViews,
      },
    });

    return {
      ...share,
      permissions: toJsonStringArray(share.permissions),
    };
  }

  static async findByCode(code: string): Promise<ShareRecord | null> {
    const prisma = getPrisma();
    const share = await prisma.share.findUnique({
      where: { code },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            path: true,
            type: true,
            size: true,
            mimeType: true,
            repositoryId: true,
          },
        },
        creator: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (!share) return null;

    return {
      ...share,
      permissions: toJsonStringArray(share.permissions),
    };
  }

  static async findById(id: string): Promise<ShareRecord | null> {
    const prisma = getPrisma();
    const share = await prisma.share.findUnique({
      where: { id },
      include: {
        document: true,
        creator: {
          select: { id: true, name: true, username: true },
        },
      },
    });

    if (!share) return null;

    return {
      ...share,
      permissions: toJsonStringArray(share.permissions),
    };
  }

  static async findAll(options: ShareQueryOptions = {}): Promise<{
    shares: ShareRecord[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const prisma = getPrisma();
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ShareWhereInput = {};

    if (options.creatorId) {
      where.creatorId = options.creatorId;
    }

    if (options.documentId) {
      where.documentId = options.documentId;
    }

    if (options.status) {
      where.status = options.status;
    }

    const [shares, total] = await Promise.all([
      prisma.share.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          document: {
            select: { id: true, name: true, path: true, type: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.share.count({ where }),
    ]);

    return {
      shares: shares.map((share) => ({
        ...share,
        permissions: toJsonStringArray(share.permissions),
      })),
      total,
      page,
      pageSize,
    };
  }

  static async access(code: string, password?: string): Promise<ShareAccessResult> {
    const prisma = getPrisma();

    const share = await this.findByCode(code);
    if (!share) {
      throw new NotFoundError('分享链接');
    }

    if (share.status !== 'ACTIVE') {
      throw new ValidationError('分享链接已失效');
    }

    if (share.expiresAt && new Date() > share.expiresAt) {
      await prisma.share.update({
        where: { id: share.id },
        data: { status: 'EXPIRED' },
      });
      throw new ValidationError('分享链接已过期');
    }

    if (share.maxViews && share.viewCount >= share.maxViews) {
      await prisma.share.update({
        where: { id: share.id },
        data: { status: 'EXPIRED' },
      });
      throw new ValidationError('分享链接访问次数已达上限');
    }

    if (share.shareType === 'PASSWORD') {
      if (!password) {
        throw new ValidationError('请输入提取码');
      }
      const isValid = await bcrypt.compare(password, share.password!);
      if (!isValid) {
        throw new ValidationError('提取码错误');
      }
    }

    await prisma.share.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 } },
    });

    const document = await prisma.document.findUnique({
      where: { id: share.documentId },
      select: {
        id: true,
        name: true,
        path: true,
        type: true,
        size: true,
        mimeType: true,
      },
    });

    if (!document) {
      throw new NotFoundError('文档');
    }

    return { share, document };
  }

  static async incrementDownload(shareId: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.share.update({
      where: { id: shareId },
      data: { downloadCount: { increment: 1 } },
    });
  }

  static async disable(id: string, userId: string): Promise<void> {
    const prisma = getPrisma();

    const share = await this.findById(id);
    if (!share) {
      throw new NotFoundError('分享');
    }

    if (share.creatorId !== userId) {
      throw new AuthorizationError('无权操作此分享');
    }

    await prisma.share.update({
      where: { id },
      data: { status: 'DISABLED' },
    });
  }

  static async delete(id: string, userId: string): Promise<void> {
    const prisma = getPrisma();

    const share = await this.findById(id);
    if (!share) {
      throw new NotFoundError('分享');
    }

    if (share.creatorId !== userId) {
      throw new AuthorizationError('无权操作此分享');
    }

    await prisma.share.delete({ where: { id } });
  }

  static async checkPermission(share: ShareRecord, permission: string): Promise<boolean> {
    return share.permissions.includes(permission);
  }

  private static generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let code = '';
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
