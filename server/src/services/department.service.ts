import { getPrisma } from '../config/database.js';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import type { Department } from '@prisma/client';

export type OrganizationType = 'GROUP' | 'COMPANY';

export interface CompanyConfigItem {
  name: string;
  code: string;
}

export type DepartmentNodeType = 'ROOT' | 'COMPANY_ROOT' | 'COMPANY' | 'DEPARTMENT';

export interface DepartmentTreeNode {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  sortOrder: number;
  parentId?: string | null;
  organizationType: OrganizationType;
  nodeType: DepartmentNodeType;
  userCount: number;
  isRoot: boolean;
  children: DepartmentTreeNode[];
}

export interface CreateDepartmentInput {
  name: string;
  code: string;
  description?: string;
  sortOrder?: number;
  parentId?: string;
  organizationType?: OrganizationType;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  description?: string;
  sortOrder?: number;
}

const ROOT_DEPARTMENTS = [
  {
    organizationType: 'GROUP' as const,
    code: 'ORG_GROUP_ROOT',
    name: '文雨集团',
    sortOrder: 0,
  },
  {
    organizationType: 'COMPANY' as const,
    code: 'ORG_COMPANY_ROOT',
    name: '公司目录',
    sortOrder: 1,
  },
] as const;

const ROOT_CODE_SET: Set<string> = new Set(ROOT_DEPARTMENTS.map((item) => item.code));

export class DepartmentService {
  private static getRootCodeByType(organizationType: OrganizationType): string {
    return ROOT_DEPARTMENTS.find((item) => item.organizationType === organizationType)!.code;
  }

  private static getTypeByRootCode(code: string): OrganizationType | null {
    const match = ROOT_DEPARTMENTS.find((item) => item.code === code);
    return match ? match.organizationType : null;
  }

  static getRootCodes(): string[] {
    return ROOT_DEPARTMENTS.map((item) => item.code);
  }

  static async ensureDefaultRoots(groupName?: string): Promise<void> {
    const prisma = getPrisma();
    const rootNameMap = {
      ORG_GROUP_ROOT: groupName?.trim() || ROOT_DEPARTMENTS[0].name,
      ORG_COMPANY_ROOT: ROOT_DEPARTMENTS[1].name,
    } as const;
    await Promise.all(
      ROOT_DEPARTMENTS.map((item) =>
        prisma.department.upsert({
          where: { code: item.code },
          update: {
            name: rootNameMap[item.code],
            parentId: null,
            sortOrder: item.sortOrder,
          },
          create: {
            name: rootNameMap[item.code],
            code: item.code,
            description: `系统内置${rootNameMap[item.code]}根节点`,
            parentId: null,
            sortOrder: item.sortOrder,
          },
        })
      )
    );
  }

  static async syncOrganizationConfig(groupName: string, companies: CompanyConfigItem[]): Promise<void> {
    await this.ensureDefaultRoots(groupName);
    const prisma = getPrisma();
    const companyRoot = await prisma.department.findUnique({
      where: { code: 'ORG_COMPANY_ROOT' },
      select: { id: true },
    });

    if (!companyRoot) {
      throw new NotFoundError('公司目录根节点');
    }

    const normalizedCompanies = companies
      .map((item) => ({
        name: item.name.trim(),
        code: item.code.trim(),
      }))
      .filter((item) => item.name && item.code);

    for (const [index, company] of normalizedCompanies.entries()) {
      const existing = await prisma.department.findUnique({
        where: { code: company.code },
        select: { id: true, parentId: true },
      });

      if (existing && existing.parentId && existing.parentId !== companyRoot.id) {
        continue;
      }

      await prisma.department.upsert({
        where: { code: company.code },
        update: {
          name: company.name,
          parentId: companyRoot.id,
          sortOrder: index,
        },
        create: {
          name: company.name,
          code: company.code,
          parentId: companyRoot.id,
          sortOrder: index,
          description: '系统配置同步公司节点',
        },
      });
    }
  }

  static async getTree(): Promise<DepartmentTreeNode[]> {
    await this.ensureDefaultRoots();
    const prisma = getPrisma();

    const roots = await prisma.department.findMany({
      where: { code: { in: this.getRootCodes() } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const rootMap = new Map(roots.map((root) => [root.code, root]));
    const groupRoot = rootMap.get('ORG_GROUP_ROOT');
    const companyRoot = rootMap.get('ORG_COMPANY_ROOT');
    if (!groupRoot || !companyRoot) {
      throw new NotFoundError('组织根节点');
    }

    const allNodes = await prisma.department.findMany({
      where: {
        code: {
          notIn: this.getRootCodes(),
        },
      },
      include: {
        parent: {
          include: {
            parent: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const groupDepartments = allNodes.filter((item) => item.parentId === groupRoot.id);
    const companyNodes = allNodes.filter((item) => item.parentId === companyRoot.id);
    const companyDepartmentsByParentId = allNodes.reduce<Record<string, DepartmentTreeNode[]>>(
      (acc, item) => {
        const isCompanyDepartment = item.parent?.parent?.code === 'ORG_COMPANY_ROOT';
        if (!isCompanyDepartment || !item.parentId) {
          return acc;
        }
        if (!acc[item.parentId]) {
          acc[item.parentId] = [];
        }
        acc[item.parentId].push({
          id: item.id,
          name: item.name,
          code: item.code,
          description: item.description,
          sortOrder: item.sortOrder,
          parentId: item.parentId,
          organizationType: 'COMPANY',
          nodeType: 'DEPARTMENT',
          userCount: item._count.users,
          isRoot: false,
          children: [],
        });
        return acc;
      },
      {}
    );

    const groupRootNode: DepartmentTreeNode = {
      id: groupRoot.id,
      name: groupRoot.name,
      code: groupRoot.code,
      description: groupRoot.description,
      sortOrder: groupRoot.sortOrder,
      parentId: null,
      organizationType: 'GROUP',
      nodeType: 'ROOT',
      userCount: 0,
      isRoot: true,
      children: [
        ...groupDepartments.map((item) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          description: item.description,
          sortOrder: item.sortOrder,
          parentId: item.parentId,
          organizationType: 'GROUP' as const,
          nodeType: 'DEPARTMENT' as const,
          userCount: item._count.users,
          isRoot: false,
          children: [],
        })),
        ...companyNodes.map((company) => ({
          id: company.id,
          name: company.name,
          code: company.code,
          description: company.description,
          sortOrder: company.sortOrder,
          parentId: company.parentId,
          organizationType: 'COMPANY' as const,
          nodeType: 'COMPANY' as const,
          userCount: company._count.users,
          isRoot: false,
          children: companyDepartmentsByParentId[company.id] || [],
        })),
      ],
    };

    groupRootNode.userCount = groupRootNode.children.reduce((sum, item) => {
      if (item.nodeType === 'COMPANY') {
        return sum + item.children.reduce((childSum, child) => childSum + child.userCount, 0);
      }
      return sum + item.userCount;
    }, 0);

    console.log('[DepartmentService.getTree] Returning tree with root:', {
      rootName: groupRootNode.name,
      childrenCount: groupRootNode.children.length,
      children: groupRootNode.children.map(c => ({ name: c.name, nodeType: c.nodeType })),
    });

    // 只返回集团根节点,不返回公司目录根节点(避免重复)
    return [groupRootNode];
  }

  static async create(input: CreateDepartmentInput): Promise<DepartmentTreeNode> {
    await this.ensureDefaultRoots();
    const prisma = getPrisma();

    const parent = await this.resolveRootParent(input);

    const existingCode = await prisma.department.findUnique({
      where: { code: input.code },
      select: { id: true },
    });
    if (existingCode) {
      throw new ConflictError('部门编码已存在');
    }

    const department = await prisma.department.create({
      data: {
        name: input.name,
        code: input.code,
        description: input.description,
        sortOrder: input.sortOrder ?? 0,
        parentId: parent.id,
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return {
      id: department.id,
      name: department.name,
      code: department.code,
      description: department.description,
      sortOrder: department.sortOrder,
      parentId: department.parentId,
      organizationType: parent.organizationType,
      nodeType: parent.nodeType,
      userCount: department._count.users,
      isRoot: false,
      children: [],
    };
  }

  static async update(id: string, input: UpdateDepartmentInput): Promise<DepartmentTreeNode> {
    const prisma = getPrisma();
    const existing = await prisma.department.findUnique({
      where: { id },
      include: {
        parent: {
          include: {
            parent: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('部门');
    }
    if (ROOT_CODE_SET.has(existing.code)) {
      throw new ValidationError('系统根节点不可修改');
    }
    const isCompanyNode = existing.parent?.code === 'ORG_COMPANY_ROOT';
    const isGroupDepartment = existing.parent?.code === 'ORG_GROUP_ROOT';
    const isCompanyDepartment = existing.parent?.parent?.code === 'ORG_COMPANY_ROOT';
    if (!isCompanyNode && !isGroupDepartment && !isCompanyDepartment) {
      throw new ValidationError('仅支持管理公司或职能部门');
    }

    if (input.code && input.code !== existing.code) {
      const codeExists = await prisma.department.findUnique({
        where: { code: input.code },
        select: { id: true },
      });
      if (codeExists) {
        throw new ConflictError('部门编码已存在');
      }
    }

    const updated = await prisma.department.update({
      where: { id },
      data: input,
      include: {
        parent: {
          include: {
            parent: true,
          },
        },
        _count: {
          select: { users: true },
        },
      },
    });

    const organizationType = this.resolveOrganizationTypeByParent(updated.parent);
    if (!organizationType) {
      throw new ValidationError('部门层级异常');
    }
    const nodeType = updated.parent?.code === 'ORG_COMPANY_ROOT' ? 'COMPANY' : 'DEPARTMENT';

    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      description: updated.description,
      sortOrder: updated.sortOrder,
      parentId: updated.parentId,
      organizationType,
      nodeType,
      userCount: updated._count.users,
      isRoot: false,
      children: [],
    };
  }

  static async delete(id: string): Promise<void> {
    const prisma = getPrisma();
    const existing = await prisma.department.findUnique({
      where: { id },
      include: {
        parent: {
          include: {
            parent: true,
          },
        },
        _count: {
          select: {
            children: true,
            users: true,
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError('部门');
    }
    if (ROOT_CODE_SET.has(existing.code)) {
      throw new ValidationError('系统根节点不可删除');
    }
    const isCompanyNode = existing.parent?.code === 'ORG_COMPANY_ROOT';
    const isGroupDepartment = existing.parent?.code === 'ORG_GROUP_ROOT';
    const isCompanyDepartment = existing.parent?.parent?.code === 'ORG_COMPANY_ROOT';
    if (!isCompanyNode && !isGroupDepartment && !isCompanyDepartment) {
      throw new ValidationError('仅支持删除公司或职能部门');
    }
    if (existing._count.children > 0) {
      throw new ConflictError('请先删除下级部门');
    }
    if (existing._count.users > 0) {
      throw new ConflictError('该部门下存在用户，无法删除');
    }

    await prisma.department.delete({
      where: { id },
    });
  }

  static async reorder(id: string, targetParentId: string, targetIndex: number): Promise<void> {
    const prisma = getPrisma();

    const [node, targetParent, companyRoot] = await Promise.all([
      prisma.department.findUnique({
        where: { id },
        include: {
          parent: {
            include: {
              parent: true,
            },
          },
        },
      }),
      prisma.department.findUnique({
        where: { id: targetParentId },
        include: {
          parent: true,
        },
      }),
      prisma.department.findUnique({
        where: { code: 'ORG_COMPANY_ROOT' },
        select: { id: true },
      }),
    ]);

    if (!node) {
      throw new NotFoundError('组织');
    }
    if (!targetParent) {
      throw new NotFoundError('目标父级组织');
    }
    if (!companyRoot) {
      throw new NotFoundError('公司目录根节点');
    }
    if (ROOT_CODE_SET.has(node.code)) {
      throw new ValidationError('根节点不支持拖拽');
    }
    if (id === targetParentId) {
      throw new ValidationError('不能拖拽到自身');
    }

    const sourceIsCompany = node.parent?.code === 'ORG_COMPANY_ROOT';
    const sourceIsDepartment =
      node.parent?.code === 'ORG_GROUP_ROOT' || node.parent?.parent?.code === 'ORG_COMPANY_ROOT';

    let actualTargetParentId: string;

    if (targetParent.code === 'ORG_GROUP_ROOT') {
      actualTargetParentId = sourceIsCompany ? companyRoot.id : targetParent.id;
    } else if (targetParent.code === 'ORG_COMPANY_ROOT') {
      if (!sourceIsCompany) {
        throw new ValidationError('只有公司节点可拖入公司目录');
      }
      actualTargetParentId = targetParent.id;
    } else if (targetParent.parent?.code === 'ORG_COMPANY_ROOT') {
      if (!sourceIsDepartment) {
        throw new ValidationError('公司节点不能拖拽到公司下');
      }
      actualTargetParentId = targetParent.id;
    } else {
      throw new ValidationError('目标父级组织不合法');
    }

    const oldParentId = node.parentId;

    await prisma.$transaction(async (tx) => {
      if (oldParentId !== actualTargetParentId) {
        await tx.department.update({
          where: { id: node.id },
          data: { parentId: actualTargetParentId },
        });
      }

      const targetSiblings = await tx.department.findMany({
        where: {
          parentId: actualTargetParentId,
          id: { not: node.id },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      });

      const nextIndex = Math.max(0, Math.min(targetIndex, targetSiblings.length));
      const reordered = [...targetSiblings];
      reordered.splice(nextIndex, 0, {
        ...node,
        parentId: actualTargetParentId,
      });

      for (const [index, item] of reordered.entries()) {
        await tx.department.update({
          where: { id: item.id },
          data: { sortOrder: index },
        });
      }

      if (oldParentId && oldParentId !== actualTargetParentId) {
        const oldSiblings = await tx.department.findMany({
          where: {
            parentId: oldParentId,
            id: { not: node.id },
          },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        });

        for (const [index, item] of oldSiblings.entries()) {
          await tx.department.update({
            where: { id: item.id },
            data: { sortOrder: index },
          });
        }
      }
    });
  }

  static async ensureFunctionalDepartment(
    departmentId: string
  ): Promise<Department & { parent: (Department & { parent: Department | null }) | null }> {
    const prisma = getPrisma();
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        parent: {
          include: {
            parent: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundError('部门');
    }
    const isGroupDepartment = department.parent?.code === 'ORG_GROUP_ROOT';
    const isCompanyDepartment = department.parent?.parent?.code === 'ORG_COMPANY_ROOT';
    if (!isGroupDepartment && !isCompanyDepartment) {
      throw new ValidationError('用户必须归属到职能部门');
    }

    return department;
  }

  private static async resolveRootParent(input: CreateDepartmentInput): Promise<{
    id: string;
    organizationType: OrganizationType;
    nodeType: DepartmentNodeType;
  }> {
    const prisma = getPrisma();

    if (input.parentId) {
      const parent = await prisma.department.findUnique({
        where: { id: input.parentId },
        include: {
          parent: true,
        },
      });
      if (!parent) {
        throw new NotFoundError('上级部门');
      }
      if (parent.code === 'ORG_GROUP_ROOT') {
        return { id: parent.id, organizationType: 'GROUP', nodeType: 'DEPARTMENT' };
      }
      const isCompanyNode = parent.parent?.code === 'ORG_COMPANY_ROOT';
      if (isCompanyNode) {
        return { id: parent.id, organizationType: 'COMPANY', nodeType: 'DEPARTMENT' };
      }
      throw new ValidationError('职能部门仅支持在集团或公司下创建');
    }

    if (!input.organizationType) {
      throw new ValidationError('缺少组织分类');
    }

    const rootCode = this.getRootCodeByType(input.organizationType);
    const root = await prisma.department.findUnique({
      where: { code: rootCode },
      select: { id: true },
    });

    if (!root) {
      throw new NotFoundError('组织根节点');
    }

    return {
      id: root.id,
      organizationType: input.organizationType,
      nodeType: input.organizationType === 'GROUP' ? 'DEPARTMENT' : 'COMPANY',
    };
  }

  private static resolveOrganizationTypeByParent(
    parent: (Department & { parent?: Department | null }) | null
  ): OrganizationType | null {
    if (!parent) {
      return null;
    }
    if (parent.code === 'ORG_GROUP_ROOT') {
      return 'GROUP';
    }
    if (parent.code === 'ORG_COMPANY_ROOT' || parent.parent?.code === 'ORG_COMPANY_ROOT') {
      return 'COMPANY';
    }
    return null;
  }

  /**
   * 获取部门的完整路径名称（从根到叶子）
   * 例如：文雨集团-行政部、陕西公司-行政部
   */
  static async getDepartmentFullPath(departmentId: string): Promise<string> {
    const prisma = getPrisma();
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        parent: {
          include: {
            parent: true,
          },
        },
      },
    });

    if (!department) {
      return '';
    }

    const path: string[] = [];

    // 添加当前部门名称
    path.unshift(department.name);

    // 如果有父部门，添加父部门名称
    if (department.parent) {
      // 如果父部门不是 ORG_COMPANY_ROOT（公司目录根节点），则添加
      if (department.parent.code !== 'ORG_COMPANY_ROOT') {
        path.unshift(department.parent.name);

        // 如果父部门还有父部门，添加祖父部门名称
        if (department.parent.parent && department.parent.parent.code !== 'ORG_COMPANY_ROOT') {
          path.unshift(department.parent.parent.name);
        }
      }
    }

    return path.join('-');
  }

  /**
   * 批量获取部门的完整路径名称
   */
  static async getDepartmentsFullPath(departmentIds: string[]): Promise<Map<string, string>> {
    const prisma = getPrisma();
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds } },
      include: {
        parent: {
          include: {
            parent: true,
          },
        },
      },
    });

    const pathMap = new Map<string, string>();

    for (const department of departments) {
      const path: string[] = [];

      // 添加当前部门名称
      path.unshift(department.name);

      // 如果有父部门，添加父部门名称
      if (department.parent) {
        // 如果父部门不是 ORG_COMPANY_ROOT（公司目录根节点），则添加
        if (department.parent.code !== 'ORG_COMPANY_ROOT') {
          path.unshift(department.parent.name);

          // 如果父部门还有父部门，添加祖父部门名称
          if (department.parent.parent && department.parent.parent.code !== 'ORG_COMPANY_ROOT') {
            path.unshift(department.parent.parent.name);
          }
        }
      }

      pathMap.set(department.id, path.join('-'));
    }

    return pathMap;
  }
}
