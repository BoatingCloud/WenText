import fs from 'fs/promises';
import { getPrisma } from '../config/database.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { config } from '../config/index.js';
import { logger } from '../config/logger.js';
import { StorageFactory, StorageAdapterConfig, MirroredStorageAdapter } from '../storage-adapters/index.js';
import { cacheGet, cacheSet, cacheDel } from '../config/redis.js';
import { SystemConfigService } from './system-config.service.js';
import { UserDataPermissionService } from './user-data-permission.service.js';
import type { Repository, StorageType, RepoStatus, Prisma, PermissionTarget, DataScope } from '@prisma/client';

export interface CreateRepositoryInput {
  name: string;
  code: string;
  description?: string;
  companyCode?: string | null;
  storageType: StorageType;
  storagePath: string;
  storageConfig?: Record<string, unknown>;
  versionEnabled?: boolean;
  maxVersions?: number;
  encryptEnabled?: boolean;
  encryptAlgorithm?: string;
}

export interface UpdateRepositoryInput {
  name?: string;
  description?: string;
  companyCode?: string | null;
  storageConfig?: Record<string, unknown>;
  versionEnabled?: boolean;
  maxVersions?: number;
  encryptEnabled?: boolean;
  encryptAlgorithm?: string;
  status?: RepoStatus;
}

export interface RepoPermissionInput {
  targetType: PermissionTarget;
  targetId: string;
  permissions: string[];
  dataScope?: DataScope;
  scopePaths?: string[];
}

export interface RepositoryQueryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  storageType?: StorageType;
  status?: RepoStatus;
  userId?: string;
}

const repositorySelect = {
  id: true,
  name: true,
  code: true,
  description: true,
  companyCode: true,
  storageType: true,
  storagePath: true,
  storageConfig: true,
  versionEnabled: true,
  maxVersions: true,
  encryptEnabled: true,
  encryptAlgorithm: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RepositorySelect;

type RepositoryRow = Prisma.RepositoryGetPayload<{ select: typeof repositorySelect }>;
type RepositoryStats = { fileCount: number; totalSize: bigint };

export class RepositoryService {
  private static readonly CACHE_PREFIX = 'repo:';
  private static readonly CACHE_TTL = 300;

  private static async collectStats(repositoryIds: string[]): Promise<Map<string, RepositoryStats>> {
    const statsMap = new Map<string, RepositoryStats>();

    if (repositoryIds.length === 0) {
      return statsMap;
    }

    const prisma = getPrisma();
    const grouped = await prisma.document.groupBy({
      by: ['repositoryId'],
      where: {
        repositoryId: { in: repositoryIds },
        type: 'FILE',
        status: 'NORMAL',
      },
      _count: { _all: true },
      _sum: { size: true },
    });

    for (const item of grouped) {
      statsMap.set(item.repositoryId, {
        fileCount: item._count._all,
        totalSize: item._sum.size || BigInt(0),
      });
    }

    return statsMap;
  }

  private static withStats(row: RepositoryRow, stats?: RepositoryStats): Repository {
    return {
      ...row,
      fileCount: stats?.fileCount ?? 0,
      totalSize: stats?.totalSize ?? BigInt(0),
    } as Repository;
  }

  private static isMissingColumnError(error: unknown): boolean {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { code?: string }).code === 'P2022';
  }

  static async findById(id: string): Promise<Repository | null> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cached = await cacheGet<Repository>(cacheKey);
    if (cached) return cached;

    const prisma = getPrisma();
    const repo = await prisma.repository.findUnique({
      where: { id },
      select: repositorySelect,
    });

    if (repo) {
      const stats = await this.collectStats([repo.id]);
      const repository = this.withStats(repo, stats.get(repo.id));
      await cacheSet(cacheKey, repository, this.CACHE_TTL);
      return repository;
    }

    return null;
  }

  static async findByCode(code: string): Promise<Repository | null> {
    const prisma = getPrisma();
    const repo = await prisma.repository.findUnique({
      where: { code },
      select: repositorySelect,
    });

    if (!repo) {
      return null;
    }

    const stats = await this.collectStats([repo.id]);
    return this.withStats(repo, stats.get(repo.id));
  }

  static async findAll(options: RepositoryQueryOptions = {}): Promise<{
    repositories: Repository[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const prisma = getPrisma();
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.RepositoryWhereInput = {};

    // 公司权限过滤
    if (options.userId) {
      const ctx = await UserDataPermissionService.getAccessScopeContext(options.userId);
      if (!ctx.isSystemAdmin) {
        // 非管理员需要过滤公司权限
        if (ctx.companyCodes.length > 0) {
          where.OR = [
            { companyCode: { in: ctx.companyCodes } },
            { companyCode: null }, // 允许访问未分配公司的仓库
          ];
        } else {
          // 无任何公司权限，只能看到未分配公司的仓库
          where.companyCode = null;
        }
      }
    }

    if (options.search) {
      const searchCondition = {
        OR: [
          { name: { contains: options.search } },
          { code: { contains: options.search } },
        ],
      };

      if (where.OR) {
        // 如果已经有 OR 条件（公司权限），需要合并
        where.AND = [
          { OR: where.OR },
          searchCondition,
        ];
        delete where.OR;
      } else {
        where.OR = searchCondition.OR;
      }
    }

    if (options.storageType) {
      where.storageType = options.storageType;
    }

    if (options.status) {
      where.status = options.status;
    } else {
      where.status = { not: 'DELETED' };
    }

    const [rows, total] = await Promise.all([
      prisma.repository.findMany({
        where,
        skip,
        take: pageSize,
        select: repositorySelect,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.repository.count({ where }),
    ]);

    const stats = await this.collectStats(rows.map((row) => row.id));
    const repositories = rows.map((row) => this.withStats(row, stats.get(row.id)));

    return {
      repositories,
      total,
      page,
      pageSize,
    };
  }

  static async findAccessible(userId: string, userRoleIds: string[], departmentId?: string): Promise<Repository[]> {
    const prisma = getPrisma();

    const rows = await prisma.repository.findMany({
      where: {
        status: { not: 'DELETED' },
        OR: [
          {
            permissions: {
              some: {
                targetType: 'USER',
                targetId: userId,
              },
            },
          },
          {
            permissions: {
              some: {
                targetType: 'ROLE',
                targetId: { in: userRoleIds },
              },
            },
          },
          ...(departmentId
            ? [
                {
                  permissions: {
                    some: {
                      targetType: 'DEPARTMENT' as PermissionTarget,
                      targetId: departmentId,
                    },
                  },
                },
              ]
            : []),
        ],
      },
      select: repositorySelect,
      orderBy: { createdAt: 'desc' },
    });

    const stats = await this.collectStats(rows.map((row) => row.id));
    return rows.map((row) => this.withStats(row, stats.get(row.id)));
  }

  static async create(input: CreateRepositoryInput): Promise<Repository> {
    const prisma = getPrisma();
    const repoDefaults = await SystemConfigService.getRepositoryDefaults();
    const normalizedBasePath = repoDefaults.basePath.replace(/\/+$/, '');
    const storagePath = input.storagePath?.trim() || `${normalizedBasePath}/${input.code}`;

    const existing = await prisma.repository.findFirst({
      where: {
        OR: [
          { name: input.name },
          { code: input.code },
        ],
      },
    });

    if (existing) {
      throw new ConflictError(
        existing.code === input.code ? '仓库编码已存在' : '仓库名称已存在'
      );
    }

    const backupBase = config.STORAGE_BACKUP_BASE_PATH.replace(/\/+$/, '');
    const normalizedStorageConfig = input.storageType === 'LOCAL'
      ? {
          ...(input.storageConfig || {}),
          backup: (input.storageConfig as Record<string, unknown> | undefined)?.backup || {
            enabled: true,
            type: 'LOCAL',
            basePath: `${backupBase}/${input.code}`,
          },
        }
      : input.storageConfig;

    const storageConfig = this.buildStorageConfig(input.storageType, storagePath, normalizedStorageConfig);
    const adapter = StorageFactory.create(storageConfig);
    await adapter.connect();

    const row = await prisma.repository.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description,
        companyCode: input.companyCode ?? null,
        storageType: input.storageType,
        storagePath,
        storageConfig: normalizedStorageConfig as Prisma.InputJsonValue | undefined,
        versionEnabled: input.versionEnabled ?? true,
        maxVersions: input.maxVersions ?? repoDefaults.maxVersions,
        encryptEnabled: input.encryptEnabled ?? false,
        encryptAlgorithm: input.encryptAlgorithm,
      },
      select: repositorySelect,
    });

    return this.withStats(row);
  }

  static async update(id: string, input: UpdateRepositoryInput): Promise<Repository> {
    const prisma = getPrisma();

    const existing = await prisma.repository.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) {
      throw new NotFoundError('仓库');
    }

    if (input.name && input.name !== existing.name) {
      const nameExists = await prisma.repository.findFirst({
        where: { name: input.name, id: { not: id } },
      });
      if (nameExists) {
        throw new ConflictError('仓库名称已存在');
      }
    }

    const { storageConfig, ...restInput } = input;
    const updateData: Prisma.RepositoryUpdateInput = {
      ...restInput,
      ...(storageConfig !== undefined
        ? { storageConfig: storageConfig as Prisma.InputJsonValue }
        : {}),
    };

    const row = await prisma.repository.update({
      where: { id },
      data: updateData,
      select: repositorySelect,
    });

    await cacheDel(`${this.CACHE_PREFIX}${id}`);
    const stats = await this.collectStats([id]);
    return this.withStats(row, stats.get(id));
  }

  static async delete(id: string, permanent = false): Promise<void> {
    const prisma = getPrisma();

    const existing = await prisma.repository.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundError('仓库');
    }

    if (permanent) {
      await StorageFactory.removeAdapter(id);
      await prisma.repository.delete({ where: { id } });
    } else {
      await prisma.repository.update({
        where: { id },
        data: { status: 'DELETED' },
      });
    }

    await cacheDel(`${this.CACHE_PREFIX}${id}`);
  }

  static async setPermissions(repoId: string, permissions: RepoPermissionInput[]): Promise<void> {
    const prisma = getPrisma();

    const repo = await prisma.repository.findUnique({
      where: { id: repoId },
      select: { id: true },
    });
    if (!repo) {
      throw new NotFoundError('仓库');
    }

    await prisma.repoPermission.deleteMany({ where: { repositoryId: repoId } });

    if (permissions.length > 0) {
      await prisma.repoPermission.createMany({
        data: permissions.map((p) => ({
          repositoryId: repoId,
          targetType: p.targetType,
          targetId: p.targetId,
          permissions: p.permissions,
          dataScope: p.dataScope || 'ALL',
          scopePaths: p.scopePaths || [],
        })),
      });
    }

    await cacheDel(`${this.CACHE_PREFIX}${repoId}`);
  }

  static async checkPermission(
    repoId: string,
    userId: string,
    userRoleIds: string[],
    departmentId: string | undefined,
    requiredPermission: string
  ): Promise<boolean> {
    const prisma = getPrisma();

    const permission = await prisma.repoPermission.findFirst({
      where: {
        repositoryId: repoId,
        permissions: { has: requiredPermission },
        OR: [
          { targetType: 'USER', targetId: userId },
          { targetType: 'ROLE', targetId: { in: userRoleIds } },
          ...(departmentId
            ? [{ targetType: 'DEPARTMENT' as PermissionTarget, targetId: departmentId }]
            : []),
        ],
      },
    });

    return permission !== null;
  }

  static async getStorageAdapter(repo: Repository) {
    const primaryConfig = this.buildStorageConfig(
      repo.storageType,
      repo.storagePath,
      repo.storageConfig as Record<string, unknown> | undefined
    );
    const primaryAdapter = await StorageFactory.getAdapter(repo.id, primaryConfig);

    const backupConfig = this.buildBackupStorageConfig(
      repo.storageConfig as Record<string, unknown> | undefined
    );

    if (!backupConfig) {
      return primaryAdapter;
    }

    const backupAdapter = await StorageFactory.getAdapter(`${repo.id}:backup`, backupConfig);
    return new MirroredStorageAdapter(primaryAdapter, backupAdapter, repo.id);
  }

  private static buildStorageConfig(
    type: StorageType,
    path: string,
    config?: Record<string, unknown>
  ): StorageAdapterConfig {
    switch (type) {
      case 'LOCAL':
        return { type: 'local', basePath: path };
      case 'MINIO':
      case 'S3':
        return {
          type: type.toLowerCase() as 'minio' | 's3',
          basePath: path,
          endpoint: config?.endpoint as string,
          port: config?.port as number || 9000,
          useSSL: config?.useSSL as boolean || false,
          accessKey: config?.accessKey as string,
          secretKey: config?.secretKey as string,
          bucket: config?.bucket as string,
          region: config?.region as string,
        };
      case 'SFTP':
        return {
          type: 'sftp',
          basePath: path,
          host: config?.host as string,
          port: config?.port as number || 22,
          username: config?.username as string,
          password: config?.password as string,
          privateKey: config?.privateKey as string,
          passphrase: config?.passphrase as string,
        };
      default:
        return { type: 'local', basePath: path };
    }
  }

  private static buildBackupStorageConfig(
    config?: Record<string, unknown>
  ): StorageAdapterConfig | null {
    const backup = (config?.backup as Record<string, unknown> | undefined) || undefined;
    if (!backup || backup.enabled === false) {
      return null;
    }

    const backupType = String(backup.type || '').toUpperCase();
    const basePath = String(backup.basePath || backup.path || '').trim();

    if (backupType === 'LOCAL' && basePath) {
      return {
        type: 'local',
        basePath,
      };
    }

    if ((backupType === 'MINIO' || backupType === 'S3') && backup.endpoint && backup.accessKey && backup.secretKey && backup.bucket) {
      return {
        type: backupType.toLowerCase() as 'minio' | 's3',
        basePath: basePath || '/',
        endpoint: String(backup.endpoint),
        port: Number(backup.port || 9000),
        useSSL: backup.useSSL === true || backup.useSSL === 'true',
        accessKey: String(backup.accessKey),
        secretKey: String(backup.secretKey),
        bucket: String(backup.bucket),
        region: backup.region ? String(backup.region) : undefined,
      };
    }

    if (backupType === 'SFTP' && backup.host && backup.username && basePath) {
      return {
        type: 'sftp',
        basePath,
        host: String(backup.host),
        port: Number(backup.port || 22),
        username: String(backup.username),
        password: backup.password ? String(backup.password) : undefined,
        privateKey: backup.privateKey ? String(backup.privateKey) : undefined,
        passphrase: backup.passphrase ? String(backup.passphrase) : undefined,
      };
    }

    return null;
  }

  static async ensureStoragePaths(): Promise<void> {
    const prisma = getPrisma();
    const rows = await prisma.repository.findMany({
      where: {
        storageType: 'LOCAL',
        status: { not: 'DELETED' },
      },
      select: {
        id: true,
        code: true,
        storagePath: true,
        storageConfig: true,
      },
    });

    const oldBase = '/tmp/wenyu/storage';
    const newBase = config.STORAGE_BASE_PATH.replace(/\/+$/, '');
    const backupBase = config.STORAGE_BACKUP_BASE_PATH.replace(/\/+$/, '');

    for (const row of rows) {
      let changed = false;
      const updateData: Prisma.RepositoryUpdateInput = {};

      if (row.storagePath.startsWith(oldBase)) {
        const suffix = row.storagePath.slice(oldBase.length);
        const nextPath = `${newBase}${suffix || `/${row.code}`}`;
        if (nextPath !== row.storagePath) {
          await this.copyDirectoryIfExists(row.storagePath, nextPath);
          updateData.storagePath = nextPath;
          changed = true;
          logger.info('Repository local storage path migrated', {
            repositoryId: row.id,
            from: row.storagePath,
            to: nextPath,
          });
        }
      }

      const configValue = (row.storageConfig && typeof row.storageConfig === 'object')
        ? (row.storageConfig as Record<string, unknown>)
        : {};

      if (!configValue.backup) {
        const currentPath = String(updateData.storagePath || row.storagePath);
        const normalized = currentPath.startsWith(newBase)
          ? currentPath.slice(newBase.length).replace(/^\/+/, '')
          : row.code;
        const backupPath = `${backupBase}/${normalized || row.code}`;

        updateData.storageConfig = {
          ...configValue,
          backup: {
            enabled: true,
            type: 'LOCAL',
            basePath: backupPath,
          },
        } as Prisma.InputJsonValue;
        changed = true;
      }

      if (changed) {
        await prisma.repository.update({
          where: { id: row.id },
          data: updateData,
        });
        await cacheDel(`${this.CACHE_PREFIX}${row.id}`);
        await StorageFactory.removeAdapter(row.id);
      }
    }
  }

  private static async copyDirectoryIfExists(sourcePath: string, targetPath: string): Promise<void> {
    try {
      await fs.access(sourcePath);
    } catch {
      return;
    }

    await fs.mkdir(targetPath, { recursive: true });
    try {
      // Node 20 supports fs.cp.
      await fs.cp(sourcePath, targetPath, { recursive: true, force: false, errorOnExist: false });
    } catch {
      // Best-effort migration, ignore copy failures to avoid startup block.
    }
  }

  static async updateStats(id: string): Promise<void> {
    const prisma = getPrisma();

    const stats = await prisma.document.aggregate({
      where: { repositoryId: id, type: 'FILE', status: 'NORMAL' },
      _count: true,
      _sum: { size: true },
    });

    try {
      await prisma.repository.update({
        where: { id },
        data: {
          fileCount: stats._count,
          totalSize: stats._sum.size || BigInt(0),
        },
      });
    } catch (error) {
      if (!this.isMissingColumnError(error)) {
        throw error;
      }
    }

    await cacheDel(`${this.CACHE_PREFIX}${id}`);
  }
}
