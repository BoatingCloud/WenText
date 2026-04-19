import { getPrisma } from '../config/database.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { cacheGet, cacheSet, cacheDel } from '../config/redis.js';
import { DepartmentService, type OrganizationType } from './department.service.js';
import type { User, UserStatus, Prisma, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

export interface CreateUserInput {
  username: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
  departmentId?: string;
  roleIds?: string[];
}

export interface UpdateUserInput {
  email?: string;
  name?: string;
  phone?: string;
  avatar?: string;
  departmentId?: string | null;
  status?: UserStatus;
}

export interface UserQueryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  departmentId?: string;
  status?: UserStatus;
  roleId?: string;
  organizationType?: OrganizationType;
}

type DepartmentWithParent = Prisma.DepartmentGetPayload<{
  include: {
    parent: {
      include: {
        parent: true;
      };
    };
  };
}>;

type UserWithRelations = Prisma.UserGetPayload<{
  include: {
    department: {
      include: {
        parent: {
          include: {
            parent: true;
          };
        };
      };
    };
    roles: {
      include: {
        role: true;
      };
    };
  };
}>;

export interface UserProfile extends Omit<User, 'password'> {
  department: DepartmentWithParent | null;
  roles: Role[];
}

export class UserService {
  private static readonly CACHE_PREFIX = 'user:';
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly ORGANIZATION_ROOT_CODE: Record<OrganizationType, string> = {
    GROUP: 'ORG_GROUP_ROOT',
    COMPANY: 'ORG_COMPANY_ROOT',
  };

  static async findById(id: string): Promise<UserProfile | null> {
    const cacheKey = `${this.CACHE_PREFIX}${id}`;
    const cached = await cacheGet<UserProfile>(cacheKey);
    if (cached) return cached;

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        department: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) return null;

    const profile = this.toUserProfile(user);
    await cacheSet(cacheKey, profile, this.CACHE_TTL);
    return profile;
  }

  static async findByUsername(username: string): Promise<User | null> {
    const prisma = getPrisma();
    return prisma.user.findUnique({ where: { username } });
  }

  static async findByEmail(email: string): Promise<User | null> {
    const prisma = getPrisma();
    return prisma.user.findUnique({ where: { email } });
  }

  static async findAll(options: UserQueryOptions = {}): Promise<{
    users: UserProfile[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const prisma = getPrisma();
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};
    const andConditions: Prisma.UserWhereInput[] = [];

    if (options.search) {
      andConditions.push({
        OR: [
          { username: { contains: options.search } },
          { name: { contains: options.search } },
          { email: { contains: options.search } },
        ],
      });
    }

    if (options.departmentId) {
      // 获取部门信息，判断是否是公司节点
      const department = await prisma.department.findUnique({
        where: { id: options.departmentId },
        include: {
          parent: true,
        },
      });

      console.log('[UserService.findAll] departmentId:', options.departmentId);
      console.log('[UserService.findAll] department:', department ? {
        id: department.id,
        name: department.name,
        code: department.code,
        parentId: department.parentId,
        parentCode: department.parent?.code,
      } : null);

      if (department) {
        // 判断是否是公司节点（父节点是 ORG_COMPANY_ROOT）
        const isCompanyNode = department.parent?.code === 'ORG_COMPANY_ROOT';

        console.log('[UserService.findAll] isCompanyNode:', isCompanyNode);

        if (isCompanyNode) {
          // 如果是公司节点，查询该公司及其所有子部门的用户
          console.log('[UserService.findAll] Querying company users with OR condition');
          andConditions.push({
            OR: [
              { departmentId: options.departmentId }, // 直属该公司的用户
              {
                department: {
                  is: {
                    parentId: options.departmentId, // 该公司下的部门用户
                  },
                },
              },
            ],
          });
        } else {
          // 如果是普通部门，只查询该部门的用户
          console.log('[UserService.findAll] Querying department users');
          where.departmentId = options.departmentId;
        }
      } else {
        where.departmentId = options.departmentId;
      }
    }

    if (options.organizationType && !options.departmentId) {
      if (options.organizationType === 'GROUP') {
        andConditions.push({
          department: {
            is: {
              parent: {
                is: {
                  code: this.ORGANIZATION_ROOT_CODE.GROUP,
                },
              },
            },
          },
        });
      }

      if (options.organizationType === 'COMPANY') {
        andConditions.push({
          OR: [
            {
              department: {
                is: {
                  parent: {
                    is: {
                      code: this.ORGANIZATION_ROOT_CODE.COMPANY,
                    },
                  },
                },
              },
            },
            {
              department: {
                is: {
                  parent: {
                    is: {
                      parent: {
                        is: {
                          code: this.ORGANIZATION_ROOT_CODE.COMPANY,
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        });
      }
    }

    if (options.status) {
      where.status = options.status;
    }

    if (options.roleId) {
      where.roles = {
        some: { roleId: options.roleId },
      };
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          department: {
            include: {
              parent: {
                include: {
                  parent: true,
                },
              },
            },
          },
          roles: {
            include: {
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
    ]);

    const usersWithoutPassword = users.map((user) => this.toUserProfile(user));

    return {
      users: usersWithoutPassword,
      total,
      page,
      pageSize,
    };
  }

  static async create(input: CreateUserInput): Promise<UserProfile> {
    const prisma = getPrisma();

    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: input.username },
          { email: input.email },
        ],
      },
    });

    if (existing) {
      throw new ConflictError(
        existing.username === input.username ? '用户名已存在' : '邮箱已被注册'
      );
    }

    if (input.departmentId) {
      await DepartmentService.ensureFunctionalDepartment(input.departmentId);
    }

    const hashedPassword = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        password: hashedPassword,
        name: input.name,
        phone: input.phone,
        departmentId: input.departmentId,
        roles: input.roleIds
          ? {
              create: input.roleIds.map((roleId) => ({ roleId })),
            }
          : undefined,
      },
      include: {
        department: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    return this.toUserProfile(user);
  }

  static async update(id: string, input: UpdateUserInput): Promise<UserProfile> {
    const prisma = getPrisma();

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('用户');
    }

    if (input.email && input.email !== existing.email) {
      const emailExists = await prisma.user.findFirst({
        where: { email: input.email, id: { not: id } },
      });
      if (emailExists) {
        throw new ConflictError('邮箱已被使用');
      }
    }

    if (input.departmentId) {
      await DepartmentService.ensureFunctionalDepartment(input.departmentId);
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...input,
        departmentId: input.departmentId === undefined ? undefined : input.departmentId,
      },
      include: {
        department: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    await cacheDel(`${this.CACHE_PREFIX}${id}`);

    return this.toUserProfile(user);
  }

  static async delete(id: string): Promise<void> {
    const prisma = getPrisma();

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('用户');
    }

    await prisma.user.delete({ where: { id } });
    await cacheDel(`${this.CACHE_PREFIX}${id}`);
  }

  static async assignRoles(userId: string, roleIds: string[]): Promise<void> {
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('用户');
    }

    await prisma.userRole.deleteMany({ where: { userId } });

    if (roleIds.length > 0) {
      await prisma.userRole.createMany({
        data: roleIds.map((roleId) => ({ userId, roleId })),
      });
    }

    await cacheDel(`${this.CACHE_PREFIX}${userId}`);
  }

  static async batchAssignRoles(userIds: string[], roleIds: string[]): Promise<void> {
    if (userIds.length === 0) {
      return;
    }

    const prisma = getPrisma();
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });

    if (users.length !== userIds.length) {
      throw new NotFoundError('用户');
    }

    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({
        where: { userId: { in: userIds } },
      });

      if (roleIds.length > 0) {
        await tx.userRole.createMany({
          data: userIds.flatMap((userId) => roleIds.map((roleId) => ({ userId, roleId }))),
        });
      }
    });

    await Promise.all(userIds.map((id) => cacheDel(`${this.CACHE_PREFIX}${id}`)));
  }

  static async updateStatus(id: string, status: UserStatus): Promise<void> {
    const prisma = getPrisma();

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('用户');
    }

    await prisma.user.update({
      where: { id },
      data: { status },
    });

    await cacheDel(`${this.CACHE_PREFIX}${id}`);
  }

  private static toUserProfile(user: UserWithRelations): UserProfile {
    const { password: _, roles, ...rest } = user;
    return {
      ...rest,
      roles: roles.map((item) => item.role),
    };
  }
}
