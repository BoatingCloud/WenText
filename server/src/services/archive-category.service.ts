import { getPrisma } from '../config/database.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import type { Prisma } from '@prisma/client';

export interface CreateArchiveCategoryInput {
  name: string;
  code: string;
  parentId?: string;
  level?: number;
  sortOrder?: number;
  description?: string;
  isEnabled?: boolean;
}

export interface UpdateArchiveCategoryInput {
  name?: string;
  code?: string;
  sortOrder?: number;
  description?: string;
  isEnabled?: boolean;
}

export interface ArchiveCategoryTreeNode {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  description: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  children: ArchiveCategoryTreeNode[];
}

export class ArchiveCategoryService {
  static async create(input: CreateArchiveCategoryInput) {
    const prisma = getPrisma();

    const existing = await prisma.archiveCategory.findUnique({
      where: { code: input.code },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('分类编码已存在');
    }

    let level = 1;
    if (input.parentId) {
      const parent = await prisma.archiveCategory.findUnique({
        where: { id: input.parentId },
        select: { id: true, level: true },
      });
      if (!parent) {
        throw new NotFoundError('父级分类');
      }
      level = parent.level + 1;
    }

    return prisma.archiveCategory.create({
      data: {
        name: input.name,
        code: input.code,
        parentId: input.parentId || null,
        level,
        sortOrder: input.sortOrder ?? 0,
        description: input.description,
        isEnabled: input.isEnabled ?? true,
      },
    });
  }

  static async findById(id: string) {
    const prisma = getPrisma();
    const category = await prisma.archiveCategory.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, code: true } },
        children: { select: { id: true, name: true, code: true }, orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!category) {
      throw new NotFoundError('档案分类');
    }
    return category;
  }

  static async findAll() {
    const prisma = getPrisma();
    return prisma.archiveCategory.findMany({
      include: {
        parent: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  static async getTree(): Promise<ArchiveCategoryTreeNode[]> {
    const prisma = getPrisma();
    const all = await prisma.archiveCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const map = new Map<string, ArchiveCategoryTreeNode>();
    const roots: ArchiveCategoryTreeNode[] = [];

    for (const item of all) {
      map.set(item.id, { ...item, children: [] });
    }

    for (const item of all) {
      const node = map.get(item.id)!;
      if (item.parentId && map.has(item.parentId)) {
        map.get(item.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  static async update(id: string, input: UpdateArchiveCategoryInput) {
    const prisma = getPrisma();

    const exists = await prisma.archiveCategory.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundError('档案分类');
    }

    if (input.code) {
      const duplicate = await prisma.archiveCategory.findFirst({
        where: { code: input.code, id: { not: id } },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictError('分类编码已存在');
      }
    }

    return prisma.archiveCategory.update({
      where: { id },
      data: input as Prisma.ArchiveCategoryUpdateInput,
    });
  }

  static async remove(id: string): Promise<void> {
    const prisma = getPrisma();

    const category = await prisma.archiveCategory.findUnique({
      where: { id },
      include: { children: { select: { id: true } } },
    });
    if (!category) {
      throw new NotFoundError('档案分类');
    }

    if (category.children.length > 0) {
      throw new ConflictError('该分类下存在子分类，无法删除');
    }

    await prisma.archiveCategory.delete({ where: { id } });
  }
}
