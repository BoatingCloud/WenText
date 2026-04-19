import { getPrisma } from '../config/database.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';

export interface WorkflowNodeInput {
  name: string;
  nodeOrder: number;
  approverType: string; // USER | ROLE | DEPARTMENT_HEAD
  approverValue?: string;
  isRequired?: boolean;
}

export interface CreateBorrowWorkflowInput {
  name: string;
  description?: string;
  isDefault?: boolean;
  isEnabled?: boolean;
  nodes: WorkflowNodeInput[];
}

export interface UpdateBorrowWorkflowInput {
  name?: string;
  description?: string;
  isDefault?: boolean;
  isEnabled?: boolean;
  nodes?: WorkflowNodeInput[];
}

const workflowInclude = {
  nodes: {
    orderBy: { nodeOrder: 'asc' as const },
  },
};

export class BorrowWorkflowService {
  static async create(input: CreateBorrowWorkflowInput) {
    const prisma = getPrisma();

    // 如果设为默认，取消其他默认
    if (input.isDefault) {
      await prisma.borrowWorkflowConfig.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.borrowWorkflowConfig.create({
      data: {
        name: input.name,
        description: input.description,
        isDefault: input.isDefault ?? false,
        isEnabled: input.isEnabled ?? true,
        nodes: {
          create: (input.nodes || []).map((n) => ({
            name: n.name,
            nodeOrder: n.nodeOrder,
            approverType: n.approverType,
            approverValue: n.approverValue,
            isRequired: n.isRequired ?? true,
          })),
        },
      },
      include: workflowInclude,
    });
  }

  static async findAll() {
    const prisma = getPrisma();
    return prisma.borrowWorkflowConfig.findMany({
      include: {
        nodes: { orderBy: { nodeOrder: 'asc' } },
        _count: { select: { requests: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id: string) {
    const prisma = getPrisma();
    const workflow = await prisma.borrowWorkflowConfig.findUnique({
      where: { id },
      include: workflowInclude,
    });
    if (!workflow) {
      throw new NotFoundError('借阅工作流');
    }
    return workflow;
  }

  static async getDefault() {
    const prisma = getPrisma();
    return prisma.borrowWorkflowConfig.findFirst({
      where: { isDefault: true, isEnabled: true },
      include: workflowInclude,
    });
  }

  static async update(id: string, input: UpdateBorrowWorkflowInput) {
    const prisma = getPrisma();

    const exists = await prisma.borrowWorkflowConfig.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundError('借阅工作流');
    }

    // 如果设为默认，取消其他默认
    if (input.isDefault) {
      await prisma.borrowWorkflowConfig.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.$transaction(async (tx) => {
      // 如果提供了 nodes，先删除旧节点再创建新节点
      if (input.nodes) {
        await tx.borrowWorkflowNode.deleteMany({ where: { workflowId: id } });
        await tx.borrowWorkflowNode.createMany({
          data: input.nodes.map((n) => ({
            workflowId: id,
            name: n.name,
            nodeOrder: n.nodeOrder,
            approverType: n.approverType,
            approverValue: n.approverValue,
            isRequired: n.isRequired ?? true,
          })),
        });
      }

      return tx.borrowWorkflowConfig.update({
        where: { id },
        data: {
          name: input.name,
          description: input.description,
          isDefault: input.isDefault,
          isEnabled: input.isEnabled,
        },
        include: workflowInclude,
      });
    });
  }

  static async remove(id: string): Promise<void> {
    const prisma = getPrisma();

    const workflow = await prisma.borrowWorkflowConfig.findUnique({
      where: { id },
      include: { _count: { select: { requests: true } } },
    });
    if (!workflow) {
      throw new NotFoundError('借阅工作流');
    }

    if (workflow._count.requests > 0) {
      throw new ConflictError('该工作流已被借阅申请使用，无法删除');
    }

    await prisma.borrowWorkflowConfig.delete({ where: { id } });
  }
}
