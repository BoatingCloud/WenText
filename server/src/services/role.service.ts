import { getPrisma } from '../config/database.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { cacheGet, cacheSet, cacheDel } from '../config/redis.js';
import { asInputJsonArray, toJsonStringArray } from '../utils/json-array.js';
import type { Role, Permission, Prisma } from '@prisma/client';

export interface CreateRoleInput {
  name: string;
  code: string;
  description?: string;
  permissionIds?: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
  userCount?: number;
}

export interface RoleRepositoryPermissionInput {
  repositoryId: string;
  permissions: string[];
  dataScope?: 'ALL' | 'DEPARTMENT' | 'PERSONAL' | 'CUSTOM';
  scopePaths?: string[];
}

export interface RoleRepositoryPermission {
  repositoryId: string;
  repositoryName: string;
  repositoryCode: string;
  permissions: string[];
  dataScope: 'ALL' | 'DEPARTMENT' | 'PERSONAL' | 'CUSTOM';
  scopePaths: string[];
}

export interface RoleUserItem {
  id: string;
  username: string;
  name: string;
  email: string;
  departmentId: string | null;
  departmentName: string | null;
}

export interface RoleArchivePermissionInput {
  companyCode: string;
  permissions: string[];
}

export interface RoleArchivePermission {
  companyCode: string;
  companyName: string;
  permissions: string[];
}

export class RoleService {
  private static readonly CACHE_PREFIX = 'role:';
  private static readonly CACHE_TTL = 600; // 10 minutes

  static async findById(id: string): Promise<RoleWithPermissions | null> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cached = await cacheGet<RoleWithPermissions>(cacheKey);
    if (cached) return cached;

    const prisma = getPrisma();
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) return null;

    const result: RoleWithPermissions = {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };

    await cacheSet(cacheKey, result, this.CACHE_TTL);
    return result;
  }

  static async findByCode(code: string): Promise<RoleWithPermissions | null> {
    const prisma = getPrisma();
    const role = await prisma.role.findUnique({
      where: { code },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) return null;

    return {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };
  }

  static async findAll(options: {
    page?: number;
    pageSize?: number;
    search?: string;
  } = {}): Promise<{
    roles: RoleWithPermissions[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const prisma = getPrisma();
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.RoleWhereInput = {};

    if (options.search) {
      where.OR = [
        { name: { contains: options.search } },
        { code: { contains: options.search } },
      ];
    }

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
          _count: {
            select: {
              users: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.role.count({ where }),
    ]);

    const rolesWithPermissions: RoleWithPermissions[] = roles.map((role) => ({
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
      userCount: role._count.users,
    }));

    return {
      roles: rolesWithPermissions,
      total,
      page,
      pageSize,
    };
  }

  static async create(input: CreateRoleInput): Promise<RoleWithPermissions> {
    const prisma = getPrisma();

    const existing = await prisma.role.findFirst({
      where: {
        OR: [
          { name: input.name },
          { code: input.code },
        ],
      },
    });

    if (existing) {
      throw new ConflictError(
        existing.code === input.code ? '角色编码已存在' : '角色名称已存在'
      );
    }

    const role = await prisma.role.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description,
        permissions: input.permissionIds
          ? {
              create: input.permissionIds.map((permissionId) => ({ permissionId })),
            }
          : undefined,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    return {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };
  }

  static async update(id: string, input: UpdateRoleInput): Promise<RoleWithPermissions> {
    const prisma = getPrisma();

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('角色');
    }

    if (input.name && input.name !== existing.name) {
      const nameExists = await prisma.role.findFirst({
        where: { name: input.name, id: { not: id } },
      });
      if (nameExists) {
        throw new ConflictError('角色名称已存在');
      }
    }

    if (input.permissionIds) {
      await prisma.rolePermission.deleteMany({ where: { roleId: id } });
      await prisma.rolePermission.createMany({
        data: input.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
      });
    }

    const role = await prisma.role.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    await cacheDel(`${this.CACHE_PREFIX}${id}`);

    return {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };
  }

  static async delete(id: string): Promise<void> {
    const prisma = getPrisma();

    const existing = await prisma.role.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('角色');
    }

    if (existing.isSystem) {
      throw new ConflictError('系统角色不能删除');
    }

    await prisma.role.delete({ where: { id } });
    await cacheDel(`${this.CACHE_PREFIX}${id}`);
  }

  static async getUsers(roleId: string): Promise<RoleUserItem[]> {
    const prisma = getPrisma();
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });

    if (!role) {
      throw new NotFoundError('角色');
    }

    const rows = await prisma.userRole.findMany({
      where: { roleId },
      include: {
        user: {
          include: {
            department: true,
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    });

    return rows.map(({ user }) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      departmentId: user.departmentId,
      departmentName: user.department?.name || null,
    }));
  }

  static async setUsers(roleId: string, userIds: string[]): Promise<void> {
    const prisma = getPrisma();
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });

    if (!role) {
      throw new NotFoundError('角色');
    }

    const uniqueUserIds = [...new Set(userIds)];
    if (uniqueUserIds.length > 0) {
      const userCount = await prisma.user.count({
        where: {
          id: { in: uniqueUserIds },
        },
      });
      if (userCount !== uniqueUserIds.length) {
        throw new NotFoundError('用户');
      }
    }

    const existingRelations = await prisma.userRole.findMany({
      where: { roleId },
      select: { userId: true },
    });

    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { roleId },
      });

      if (uniqueUserIds.length > 0) {
        await tx.userRole.createMany({
          data: uniqueUserIds.map((userId) => ({ roleId, userId })),
        });
      }
    });

    const affectedUserIds = [...new Set([
      ...existingRelations.map((item) => item.userId),
      ...uniqueUserIds,
    ])];

    await Promise.all(affectedUserIds.map((userId) => cacheDel(`user:${userId}`)));
    await cacheDel(`${this.CACHE_PREFIX}${roleId}`);
  }

  static async getRepositoryPermissions(roleId: string): Promise<RoleRepositoryPermission[]> {
    const prisma = getPrisma();
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });

    if (!role) {
      throw new NotFoundError('角色');
    }

    const rows = await prisma.repoPermission.findMany({
      where: {
        targetType: 'ROLE',
        targetId: roleId,
      },
      include: {
        repository: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
      },
      orderBy: {
        repository: {
          createdAt: 'desc',
        },
      },
    });

    return rows.map((row) => ({
      repositoryId: row.repositoryId,
      repositoryName: row.repository.name,
      repositoryCode: row.repository.code,
      permissions: toJsonStringArray(row.permissions),
      dataScope: row.dataScope,
      scopePaths: toJsonStringArray(row.scopePaths),
    }));
  }

  static async setRepositoryPermissions(
    roleId: string,
    entries: RoleRepositoryPermissionInput[]
  ): Promise<void> {
    const prisma = getPrisma();
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });

    if (!role) {
      throw new NotFoundError('角色');
    }

    await prisma.$transaction(async (tx) => {
      await tx.repoPermission.deleteMany({
        where: {
          targetType: 'ROLE',
          targetId: roleId,
        },
      });

      const createData = entries
        .filter((entry) => entry.permissions.length > 0)
        .map((entry) => ({
          repositoryId: entry.repositoryId,
          targetType: 'ROLE' as const,
          targetId: roleId,
          permissions: asInputJsonArray(entry.permissions),
          dataScope: entry.dataScope ?? 'ALL',
          scopePaths: asInputJsonArray(entry.scopePaths),
        }));

      if (createData.length > 0) {
        await tx.repoPermission.createMany({
          data: createData,
        });
      }
    });
  }

  static async getArchivePermissions(roleId: string): Promise<RoleArchivePermission[]> {
    const prisma = getPrisma();
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });

    if (!role) {
      throw new NotFoundError('角色');
    }

    const permissions = await prisma.roleArchivePermission.findMany({
      where: { roleId },
      orderBy: { companyCode: 'asc' },
    });

    // 获取系统配置中的公司目录
    const systemConfig = await prisma.systemConfig.findFirst({
      where: { key: 'site_settings' },
      select: { value: true },
    });

    const companyCatalog = (systemConfig?.value as any)?.companyCatalog || [];
    const companyMap = new Map(companyCatalog.map((c: any) => [c.code, c.name]));

    return permissions.map((p) => ({
      companyCode: p.companyCode,
      companyName: (companyMap.get(p.companyCode) as string) || p.companyCode,
      permissions: toJsonStringArray(p.permissions),
    }));
  }

  static async setArchivePermissions(
    roleId: string,
    entries: RoleArchivePermissionInput[]
  ): Promise<void> {
    const prisma = getPrisma();
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true },
    });

    if (!role) {
      throw new NotFoundError('角色');
    }

    await prisma.$transaction(async (tx) => {
      await tx.roleArchivePermission.deleteMany({
        where: { roleId },
      });

      const createData = entries
        .filter((entry) => entry.permissions.length > 0)
        .map((entry) => ({
          roleId,
          companyCode: entry.companyCode,
          permissions: asInputJsonArray(entry.permissions),
        }));

      if (createData.length > 0) {
        await tx.roleArchivePermission.createMany({
          data: createData,
        });
      }
    });

    await cacheDel(`${RoleService.CACHE_PREFIX}${roleId}`);
  }
}

export class PermissionService {
  static async findAll(options: {
    module?: string;
  } = {}): Promise<Permission[]> {
    const prisma = getPrisma();

    const where: Prisma.PermissionWhereInput = {};
    if (options.module) {
      where.module = options.module;
    }

    return prisma.permission.findMany({
      where,
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    });
  }

  static async findByCode(code: string): Promise<Permission | null> {
    const prisma = getPrisma();
    return prisma.permission.findUnique({ where: { code } });
  }

  static async getModules(): Promise<string[]> {
    const prisma = getPrisma();
    const permissions = await prisma.permission.findMany({
      select: { module: true },
      distinct: ['module'],
    });
    return permissions.map((p) => p.module);
  }

  static async initDefaultPermissions(): Promise<void> {
    const prisma = getPrisma();

    const defaultPermissions = [
      // system 模块
      { code: 'system:view', name: '查看系统配置', module: 'system', description: '查看系统配置信息' },
      { code: 'system:config', name: '系统配置', module: 'system', description: '修改系统配置' },
      { code: 'system:manage', name: '系统管理', module: 'system', description: '管理系统配置' },
      // user 模块
      { code: 'user:view', name: '查看用户', module: 'user', description: '查看用户列表' },
      { code: 'user:create', name: '创建用户', module: 'user', description: '创建新用户' },
      { code: 'user:update', name: '修改用户', module: 'user', description: '修改用户信息' },
      { code: 'user:delete', name: '删除用户', module: 'user', description: '删除用户' },
      // role 模块
      { code: 'role:view', name: '查看角色', module: 'role', description: '查看角色列表' },
      { code: 'role:create', name: '创建角色', module: 'role', description: '创建新角色' },
      { code: 'role:update', name: '修改角色', module: 'role', description: '修改角色信息' },
      { code: 'role:delete', name: '删除角色', module: 'role', description: '删除角色' },
      { code: 'role:manage', name: '管理角色', module: 'role', description: '管理角色和权限' },
      // repository 模块
      { code: 'repo:view', name: '查看仓库', module: 'repository', description: '查看仓库列表' },
      { code: 'repo:create', name: '创建仓库', module: 'repository', description: '创建新仓库' },
      { code: 'repo:update', name: '修改仓库', module: 'repository', description: '修改仓库信息' },
      { code: 'repo:delete', name: '删除仓库', module: 'repository', description: '删除仓库' },
      { code: 'repo:manage', name: '管理仓库', module: 'repository', description: '管理仓库配置' },
      // document 模块
      { code: 'doc:view', name: '查看文档', module: 'document', description: '查看文档' },
      { code: 'doc:upload', name: '上传文档', module: 'document', description: '上传文档' },
      { code: 'doc:edit', name: '编辑文档', module: 'document', description: '编辑文档' },
      { code: 'doc:delete', name: '删除文档', module: 'document', description: '删除文档' },
      { code: 'doc:share', name: '分享文档', module: 'document', description: '分享文档' },
      { code: 'doc:version', name: '版本管理', module: 'document', description: '查看和管理文档版本' },
      // archive 模块
      { code: 'archive:view', name: '查看实体档案', module: 'archive', description: '查看实体档案列表和详情' },
      { code: 'archive:create', name: '创建实体档案', module: 'archive', description: '创建实体档案' },
      { code: 'archive:update', name: '更新实体档案', module: 'archive', description: '更新实体档案信息' },
      { code: 'archive:delete', name: '删除实体档案', module: 'archive', description: '删除实体档案' },
      { code: 'archive:borrow', name: '借阅实体档案', module: 'archive', description: '借阅在库实体档案' },
      { code: 'archive:return', name: '归还实体档案', module: 'archive', description: '归还实体档案并记录流水' },
      { code: 'archive:approve', name: '审批实体档案', module: 'archive', description: '审批实体档案' },
      { code: 'archive:import', name: '导入实体档案', module: 'archive', description: '批量导入实体档案' },
      { code: 'archive:export', name: '导出实体档案', module: 'archive', description: '批量导出实体档案' },
      { code: 'archive:manage', name: '管理实体档案', module: 'archive', description: '管理实体档案权限配置' },
      // search 模块
      { code: 'search:basic', name: '基础搜索', module: 'search', description: '使用基础搜索功能' },
      { code: 'search:all', name: '跨范围搜索', module: 'search', description: '忽略数据范围限制进行全局搜索' },
      { code: 'search:ai', name: 'AI搜索', module: 'search', description: '使用AI智能搜索' },
      // audit 模块
      { code: 'audit:view', name: '查看日志', module: 'audit', description: '查看审计日志' },
      // doc-review 模块
      { code: 'doc-review:view', name: '查看文档审查', module: 'doc-review', description: '查看自己的文档审查记录' },
      { code: 'doc-review:view-dept', name: '查看部门文档审查', module: 'doc-review', description: '查看本部门的文档审查记录' },
      { code: 'doc-review:view-all', name: '查看所有文档审查', module: 'doc-review', description: '查看所有文档审查记录' },
      { code: 'doc-review:create', name: '创建文档审查', module: 'doc-review', description: '创建文档审查记录' },
      { code: 'doc-review:edit-own', name: '编辑自己的审查', module: 'doc-review', description: '编辑自己创建的文档审查' },
      { code: 'doc-review:edit', name: '编辑所有审查', module: 'doc-review', description: '编辑所有文档审查记录' },
      { code: 'doc-review:delete-own', name: '删除自己的审查', module: 'doc-review', description: '删除自己创建的文档审查' },
      { code: 'doc-review:delete', name: '删除所有审查', module: 'doc-review', description: '删除所有文档审查记录' },
      { code: 'doc-review:ai-review', name: 'AI审查', module: 'doc-review', description: '触发AI审查功能' },
      { code: 'doc-review:view-ai-result', name: '查看AI结果', module: 'doc-review', description: '查看AI审查结果' },
    ];

    for (const perm of defaultPermissions) {
      await prisma.permission.upsert({
        where: { code: perm.code },
        update: {},
        create: perm,
      });
    }

    const adminRole = await prisma.role.findUnique({
      where: { code: 'admin' },
      select: { id: true },
    });

    if (adminRole) {
      const allPermissions = await prisma.permission.findMany({
        select: { id: true },
      });

      await prisma.rolePermission.createMany({
        data: allPermissions.map((permission) => ({
          roleId: adminRole.id,
          permissionId: permission.id,
        })),
        skipDuplicates: true,
      });
    }
  }
}
