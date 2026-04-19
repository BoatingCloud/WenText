import { getPrisma } from '../config/database.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { cacheDel, cacheGet, cacheSet } from '../config/redis.js';
import { SystemConfigService } from './system-config.service.js';

export interface UserCompanyScopeResult {
  userId: string;
  isAllCompanies: boolean;
  companyCodes: string[];
}

export interface UserRepositoryScopeResult {
  userId: string;
  isAllRepositories: boolean;
  repositories: Array<{
    id: string;
    code: string;
    name: string;
    companyCode: string | null;
  }>;
}

export interface UserPhysicalArchiveScopeResult {
  userId: string;
  isAllPhysicalArchives: boolean;
  physicalArchives: Array<{
    id: string;
    archiveNo: string;
    title: string;
    companyCode: string | null;
  }>;
}

export interface UserArchiveCompanyScopeResult {
  userId: string;
  isAllCompanies: boolean;
  companyCodes: string[];
}

export interface AccessScopeContext {
  userId: string;
  isSystemAdmin: boolean;
  companyCodes: string[];
  repositoryIds: string[];
  physicalArchiveIds: string[];
  archiveCompanyCodes: string[];
}

export class UserDataPermissionService {
  private static readonly CACHE_PREFIX = 'user:scope:';
  private static readonly CACHE_TTL = 300; // 5 minutes

  /**
   * 检查用户是否为系统管理员
   */
  static async isSystemAdmin(userId: string): Promise<boolean> {
    const prisma = getPrisma();
    const userWithRoles = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!userWithRoles) {
      return false;
    }

    // 检查是否有 admin 角色或 system:manage 权限
    for (const userRole of userWithRoles.roles) {
      if (userRole.role.code === 'admin') {
        return true;
      }
      for (const rolePerm of userRole.role.permissions) {
        if (rolePerm.permission.code === 'system:manage') {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 获取用户的公司范围（数据权限）
   */
  static async getCompanyScopes(userId: string): Promise<UserCompanyScopeResult> {
    const cacheKey = `${this.CACHE_PREFIX}company:${userId}`;
    const cached = await cacheGet<UserCompanyScopeResult>(cacheKey);
    if (cached) return cached;

    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('用户');
    }

    const isAdmin = await this.isSystemAdmin(userId);
    if (isAdmin) {
      const result: UserCompanyScopeResult = {
        userId,
        isAllCompanies: true,
        companyCodes: [],
      };
      await cacheSet(cacheKey, result, this.CACHE_TTL);
      return result;
    }

    const scopes = await prisma.userCompanyScope.findMany({
      where: { userId },
      select: { companyCode: true },
    });

    const result: UserCompanyScopeResult = {
      userId,
      isAllCompanies: false,
      companyCodes: scopes.map((s) => s.companyCode),
    };

    await cacheSet(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * 设置用户的公司范围（数据权限）
   */
  static async setCompanyScopes(userId: string, companyCodes: string[]): Promise<void> {
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('用户');
    }

    // 验证公司代码是否有效
    if (companyCodes.length > 0) {
      const settings = await SystemConfigService.getSiteSettings();
      const validCodes = new Set(settings.companyCatalog.map((c: { code: string }) => c.code));
      const invalidCodes = companyCodes.filter((code) => !validCodes.has(code));
      if (invalidCodes.length > 0) {
        throw new ValidationError(`无效的公司代码: ${invalidCodes.join(', ')}`);
      }
    }

    await prisma.$transaction(async (tx) => {
      // 删除现有的公司范围
      await tx.userCompanyScope.deleteMany({ where: { userId } });

      // 创建新的公司范围
      if (companyCodes.length > 0) {
        await tx.userCompanyScope.createMany({
          data: companyCodes.map((companyCode) => ({
            userId,
            companyCode,
          })),
        });
      }

      // 删除不在新公司范围内的仓库权限
      const userRepoScopes = await tx.userRepositoryScope.findMany({
        where: { userId },
        include: {
          repository: {
            select: { companyCode: true },
          },
        },
      });

      const scopesToDelete = userRepoScopes.filter(
        (scope) => scope.repository.companyCode && !companyCodes.includes(scope.repository.companyCode)
      );

      if (scopesToDelete.length > 0) {
        await tx.userRepositoryScope.deleteMany({
          where: { id: { in: scopesToDelete.map((s) => s.id) } },
        });
      }
    });

    // 清除缓存
    await cacheDel(`${this.CACHE_PREFIX}company:${userId}`);
    await cacheDel(`${this.CACHE_PREFIX}repository:${userId}`);
    await cacheDel(`${this.CACHE_PREFIX}context:${userId}`);
    await cacheDel(`user:${userId}`);
  }

  /**
   * 获取用户的仓库范围（仓库权限）
   */
  static async getRepositoryScopes(userId: string): Promise<UserRepositoryScopeResult> {
    const cacheKey = `${this.CACHE_PREFIX}repository:${userId}`;
    const cached = await cacheGet<UserRepositoryScopeResult>(cacheKey);
    if (cached) return cached;

    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('用户');
    }

    const isAdmin = await this.isSystemAdmin(userId);
    if (isAdmin) {
      const result: UserRepositoryScopeResult = {
        userId,
        isAllRepositories: true,
        repositories: [],
      };
      await cacheSet(cacheKey, result, this.CACHE_TTL);
      return result;
    }

    const scopes = await prisma.userRepositoryScope.findMany({
      where: { userId },
      include: {
        repository: {
          select: {
            id: true,
            code: true,
            name: true,
            companyCode: true,
          },
        },
      },
    });

    const result: UserRepositoryScopeResult = {
      userId,
      isAllRepositories: false,
      repositories: scopes.map((s) => ({
        id: s.repository.id,
        code: s.repository.code,
        name: s.repository.name,
        companyCode: s.repository.companyCode,
      })),
    };

    await cacheSet(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * 设置用户的仓库范围（仓库权限）
   */
  static async setRepositoryScopes(userId: string, repositoryIds: string[]): Promise<void> {
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('用户');
    }

    // 验证仓库是否存在且在用户公司范围内
    if (repositoryIds.length > 0) {
      const isAdmin = await this.isSystemAdmin(userId);

      if (!isAdmin) {
        // 获取用户的公司范围
        const companyScopes = await this.getCompanyScopes(userId);

        // 获取仓库信息
        const repositories = await prisma.repository.findMany({
          where: { id: { in: repositoryIds } },
          select: { id: true, companyCode: true },
        });

        if (repositories.length !== repositoryIds.length) {
          throw new NotFoundError('仓库');
        }

        // 检查仓库是否在用户公司范围内
        const invalidRepos = repositories.filter(
          (repo) => repo.companyCode && !companyScopes.companyCodes.includes(repo.companyCode)
        );

        if (invalidRepos.length > 0) {
          throw new ValidationError('部分仓库不在您的公司权限范围内');
        }
      } else {
        // 管理员只需验证仓库存在
        const count = await prisma.repository.count({
          where: { id: { in: repositoryIds } },
        });
        if (count !== repositoryIds.length) {
          throw new NotFoundError('仓库');
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // 删除现有的仓库范围
      await tx.userRepositoryScope.deleteMany({ where: { userId } });

      // 创建新的仓库范围
      if (repositoryIds.length > 0) {
        await tx.userRepositoryScope.createMany({
          data: repositoryIds.map((repositoryId) => ({
            userId,
            repositoryId,
          })),
        });
      }
    });

    // 清除缓存
    await cacheDel(`${this.CACHE_PREFIX}repository:${userId}`);
    await cacheDel(`${this.CACHE_PREFIX}context:${userId}`);
    await cacheDel(`user:${userId}`);
  }

  /**
   * 获取用户的完整访问范围上下文
   */
  static async getAccessScopeContext(userId: string): Promise<AccessScopeContext> {
    const cacheKey = `${this.CACHE_PREFIX}context:${userId}`;
    const cached = await cacheGet<AccessScopeContext>(cacheKey);
    if (cached) return cached;

    const isSystemAdmin = await this.isSystemAdmin(userId);

    if (isSystemAdmin) {
      const result: AccessScopeContext = {
        userId,
        isSystemAdmin: true,
        companyCodes: [],
        repositoryIds: [],
        physicalArchiveIds: [],
        archiveCompanyCodes: [],
      };
      await cacheSet(cacheKey, result, this.CACHE_TTL);
      return result;
    }

    const [companyScopes, repoScopes, archiveScopes, archiveCompanyScopes] = await Promise.all([
      this.getCompanyScopes(userId),
      this.getRepositoryScopes(userId),
      this.getPhysicalArchiveScopes(userId),
      this.getArchiveCompanyScopes(userId),
    ]);

    const result: AccessScopeContext = {
      userId,
      isSystemAdmin: false,
      companyCodes: companyScopes.companyCodes,
      repositoryIds: repoScopes.repositories.map((r) => r.id),
      physicalArchiveIds: archiveScopes.physicalArchives.map((a) => a.id),
      archiveCompanyCodes: archiveCompanyScopes.companyCodes,
    };

    await cacheSet(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * 检查用户是否有访问指定公司的权限
   */
  static async checkCompanyAccess(userId: string, companyCode: string): Promise<boolean> {
    const context = await this.getAccessScopeContext(userId);
    if (context.isSystemAdmin) {
      return true;
    }
    return context.companyCodes.includes(companyCode);
  }

  /**
   * 检查用户是否有访问指定仓库的权限
   */
  static async checkRepositoryAccess(userId: string, repositoryId: string): Promise<boolean> {
    const context = await this.getAccessScopeContext(userId);
    if (context.isSystemAdmin) {
      return true;
    }
    return context.repositoryIds.includes(repositoryId);
  }

  /**
   * 获取用户可访问的仓库 ID 列表
   */
  static async getAccessibleRepositoryIds(userId: string): Promise<string[] | null> {
    const context = await this.getAccessScopeContext(userId);
    if (context.isSystemAdmin) {
      return null; // null 表示可访问所有仓库
    }
    return context.repositoryIds;
  }

  /**
   * 清除用户的所有权限范围缓存
   */
  static async clearUserScopeCache(userId: string): Promise<void> {
    await Promise.all([
      cacheDel(`${this.CACHE_PREFIX}company:${userId}`),
      cacheDel(`${this.CACHE_PREFIX}repository:${userId}`),
      cacheDel(`${this.CACHE_PREFIX}physicalArchive:${userId}`),
      cacheDel(`${this.CACHE_PREFIX}archiveCompany:${userId}`),
      cacheDel(`${this.CACHE_PREFIX}context:${userId}`),
    ]);
  }

  // ========== 实体档案权限管理 ==========

  /**
   * 获取用户的实体档案权限范围
   */
  static async getPhysicalArchiveScopes(userId: string): Promise<UserPhysicalArchiveScopeResult> {
    const cacheKey = `${this.CACHE_PREFIX}physicalArchive:${userId}`;
    const cached = await cacheGet<UserPhysicalArchiveScopeResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const prisma = getPrisma();
    const isAdmin = await this.isSystemAdmin(userId);

    if (isAdmin) {
      const result: UserPhysicalArchiveScopeResult = {
        userId,
        isAllPhysicalArchives: true,
        physicalArchives: [],
      };
      await cacheSet(cacheKey, result, this.CACHE_TTL);
      return result;
    }

    const scopes = await prisma.userPhysicalArchiveScope.findMany({
      where: { userId },
      include: {
        physicalArchive: {
          select: {
            id: true,
            archiveNo: true,
            title: true,
            companyCode: true,
          },
        },
      },
    });

    const result: UserPhysicalArchiveScopeResult = {
      userId,
      isAllPhysicalArchives: false,
      physicalArchives: scopes.map((s) => s.physicalArchive),
    };

    await cacheSet(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * 设置用户的实体档案权限范围
   */
  static async setPhysicalArchiveScopes(userId: string, physicalArchiveIds: string[]): Promise<void> {
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('用户');
    }

    // 验证档案是否存在，并检查是否在用户的公司权限范围内
    if (physicalArchiveIds.length > 0) {
      const archives = await prisma.physicalArchive.findMany({
        where: { id: { in: physicalArchiveIds } },
        select: { id: true, companyCode: true },
      });

      if (archives.length !== physicalArchiveIds.length) {
        throw new ValidationError('部分档案不存在');
      }

      // 检查用户对这些档案所属公司的权限
      const ctx = await this.getAccessScopeContext(userId);
      if (!ctx.isSystemAdmin) {
        const invalidArchives = archives.filter(
          (archive) => archive.companyCode && !ctx.companyCodes.includes(archive.companyCode)
        );
        if (invalidArchives.length > 0) {
          throw new ValidationError('无权分配不在您公司权限范围内的档案');
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      // 删除旧的档案权限
      await tx.userPhysicalArchiveScope.deleteMany({
        where: { userId },
      });

      // 创建新的档案权限
      if (physicalArchiveIds.length > 0) {
        await tx.userPhysicalArchiveScope.createMany({
          data: physicalArchiveIds.map((physicalArchiveId) => ({
            userId,
            physicalArchiveId,
          })),
        });
      }
    });

    // 清除缓存
    await cacheDel(`${this.CACHE_PREFIX}physicalArchive:${userId}`);
    await cacheDel(`${this.CACHE_PREFIX}context:${userId}`);
    await cacheDel(`user:${userId}`);
  }

  /**
   * 获取用户的档案公司权限范围
   */
  static async getArchiveCompanyScopes(userId: string): Promise<UserArchiveCompanyScopeResult> {
    const cacheKey = `${this.CACHE_PREFIX}archiveCompany:${userId}`;
    const cached = await cacheGet<UserArchiveCompanyScopeResult>(cacheKey);
    if (cached) return cached;

    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('用户');
    }

    const isAdmin = await this.isSystemAdmin(userId);
    if (isAdmin) {
      const result: UserArchiveCompanyScopeResult = {
        userId,
        isAllCompanies: true,
        companyCodes: [],
      };
      await cacheSet(cacheKey, result, this.CACHE_TTL);
      return result;
    }

    const scopes = await prisma.userArchiveCompanyScope.findMany({
      where: { userId },
      select: { companyCode: true },
    });

    const result: UserArchiveCompanyScopeResult = {
      userId,
      isAllCompanies: false,
      companyCodes: scopes.map((s) => s.companyCode),
    };

    await cacheSet(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  /**
   * 设置用户的档案公司权限范围
   */
  static async setArchiveCompanyScopes(userId: string, companyCodes: string[]): Promise<void> {
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundError('用户');
    }

    // 验证公司代码是否存在
    if (companyCodes.length > 0) {
      const siteSettings = await SystemConfigService.getSiteSettings();
      const validCodes = siteSettings.companyCatalog.map((c: { code: string }) => c.code);
      const invalidCodes = companyCodes.filter((code) => !validCodes.includes(code));
      if (invalidCodes.length > 0) {
        throw new ValidationError(`无效的公司代码: ${invalidCodes.join(', ')}`);
      }
    }

    await prisma.$transaction(async (tx) => {
      // 删除旧的档案公司权限
      await tx.userArchiveCompanyScope.deleteMany({
        where: { userId },
      });

      // 创建新的档案公司权限
      if (companyCodes.length > 0) {
        await tx.userArchiveCompanyScope.createMany({
          data: companyCodes.map((companyCode) => ({
            userId,
            companyCode,
          })),
        });
      }
    });

    // 清除缓存
    await cacheDel(`${this.CACHE_PREFIX}archiveCompany:${userId}`);
    await cacheDel(`${this.CACHE_PREFIX}context:${userId}`);
    await cacheDel(`user:${userId}`);
  }

  /**
   * 检查用户是否有权访问指定实体档案
   */
  static async checkPhysicalArchiveAccess(userId: string, physicalArchiveId: string): Promise<boolean> {
    const context = await this.getAccessScopeContext(userId);
    if (context.isSystemAdmin) {
      return true;
    }

    // 兼容旧的“按实体档案白名单”策略
    if (context.physicalArchiveIds.includes(physicalArchiveId)) {
      return true;
    }

    // 新的“按档案公司范围”策略：可访问公司 + 未分配公司
    const prisma = getPrisma();
    const archive = await prisma.physicalArchive.findUnique({
      where: { id: physicalArchiveId },
      select: { companyCode: true },
    });

    if (!archive) {
      return false;
    }

    if (!archive.companyCode) {
      return true;
    }

    return context.archiveCompanyCodes.includes(archive.companyCode);
  }

  /**
   * 获取用户可访问的实体档案 ID 列表
   */
  static async getAccessiblePhysicalArchiveIds(userId: string): Promise<string[] | null> {
    const context = await this.getAccessScopeContext(userId);
    if (context.isSystemAdmin) {
      return null; // null 表示可访问所有档案
    }
    return context.physicalArchiveIds;
  }
}
