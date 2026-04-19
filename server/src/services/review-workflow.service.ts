import { getPrisma } from '../config/database.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import type { Prisma, ReviewWorkflowConfig, ReviewWorkflowNode } from '@prisma/client';

export interface CreateWorkflowInput {
  name: string;
  description?: string;
  documentType?: string;
  isDefault?: boolean;
  isEnabled?: boolean;
  nodes: Array<{
    name: string;
    nodeOrder: number;
    approverType: string;
    approverValue?: string;
    isRequired?: boolean;
  }>;
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  documentType?: string;
  isDefault?: boolean;
  isEnabled?: boolean;
  nodes?: Array<{
    id?: string;
    name: string;
    nodeOrder: number;
    approverType: string;
    approverValue?: string;
    isRequired?: boolean;
  }>;
}

export class ReviewWorkflowService {
  /**
   * 创建工作流
   */
  static async create(input: CreateWorkflowInput): Promise<ReviewWorkflowConfig> {
    const prisma = getPrisma();

    // 如果设置为默认工作流，先取消其他默认工作流
    if (input.isDefault) {
      await prisma.reviewWorkflowConfig.updateMany({
        where: {
          isDefault: true,
          documentType: (input.documentType as any) || null,
        },
        data: { isDefault: false },
      });
    }

    // 创建工作流和节点
    const workflow = await prisma.reviewWorkflowConfig.create({
      data: {
        name: input.name,
        description: input.description,
        documentType: input.documentType as any,
        isDefault: input.isDefault || false,
        isEnabled: input.isEnabled !== false,
        nodes: {
          create: input.nodes.map(node => ({
            name: node.name,
            nodeOrder: node.nodeOrder,
            approverType: node.approverType,
            approverValue: node.approverValue,
            isRequired: node.isRequired !== false,
          })),
        },
      },
      include: {
        nodes: {
          orderBy: { nodeOrder: 'asc' },
        },
      },
    });

    return workflow;
  }

  /**
   * 更新工作流
   */
  static async update(id: string, input: UpdateWorkflowInput): Promise<ReviewWorkflowConfig> {
    const prisma = getPrisma();

    // 检查工作流是否存在
    const existing = await prisma.reviewWorkflowConfig.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundError('工作流不存在');
    }

    // 如果设置为默认工作流，先取消其他默认工作流
    if (input.isDefault) {
      await prisma.reviewWorkflowConfig.updateMany({
        where: {
          isDefault: true,
          documentType: (input.documentType || existing.documentType) as any,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    // 更新工作流
    const updateData: Prisma.ReviewWorkflowConfigUpdateInput = {
      name: input.name,
      description: input.description,
      documentType: input.documentType as any,
      isDefault: input.isDefault,
      isEnabled: input.isEnabled,
    };

    // 如果提供了节点数据，更新节点
    if (input.nodes) {
      // 删除旧节点
      await prisma.reviewWorkflowNode.deleteMany({
        where: { workflowId: id },
      });

      // 创建新节点
      updateData.nodes = {
        create: input.nodes.map(node => ({
          name: node.name,
          nodeOrder: node.nodeOrder,
          approverType: node.approverType,
          approverValue: node.approverValue,
          isRequired: node.isRequired !== false,
        })),
      };
    }

    const workflow = await prisma.reviewWorkflowConfig.update({
      where: { id },
      data: updateData,
      include: {
        nodes: {
          orderBy: { nodeOrder: 'asc' },
        },
      },
    });

    return workflow;
  }

  /**
   * 删除工作流
   */
  static async delete(id: string): Promise<void> {
    const prisma = getPrisma();

    // 检查是否有关联的审查记录
    const count = await prisma.documentReview.count({
      where: { workflowId: id },
    });

    if (count > 0) {
      throw new ConflictError('该工作流已被使用，无法删除');
    }

    await prisma.reviewWorkflowConfig.delete({
      where: { id },
    });
  }

  /**
   * 获取工作流详情
   */
  static async getById(id: string): Promise<ReviewWorkflowConfig & { nodes: ReviewWorkflowNode[] }> {
    const prisma = getPrisma();

    const workflow = await prisma.reviewWorkflowConfig.findUnique({
      where: { id },
      include: {
        nodes: {
          orderBy: { nodeOrder: 'asc' },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundError('工作流不存在');
    }

    return workflow;
  }

  /**
   * 获取工作流列表
   */
  static async list(params?: {
    documentType?: string;
    isEnabled?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{
    data: Array<ReviewWorkflowConfig & { nodes: ReviewWorkflowNode[]; _count: { reviews: number } }>;
    total: number;
  }> {
    const prisma = getPrisma();
    const page = params?.page || 1;
    const pageSize = params?.pageSize || 20;

    const where: Prisma.ReviewWorkflowConfigWhereInput = {};

    if (params?.documentType) {
      where.documentType = params.documentType as any;
    }

    if (params?.isEnabled !== undefined) {
      where.isEnabled = params.isEnabled;
    }

    const [data, total] = await Promise.all([
      prisma.reviewWorkflowConfig.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          nodes: {
            orderBy: { nodeOrder: 'asc' },
          },
          _count: {
            select: { reviews: true },
          },
        },
      }),
      prisma.reviewWorkflowConfig.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * 获取默认工作流
   */
  static async getDefault(documentType?: string): Promise<ReviewWorkflowConfig | null> {
    const prisma = getPrisma();

    // 先查找特定文档类型的默认工作流
    if (documentType) {
      const workflow = await prisma.reviewWorkflowConfig.findFirst({
        where: {
          documentType: documentType as any,
          isDefault: true,
          isEnabled: true,
        },
        include: {
          nodes: {
            orderBy: { nodeOrder: 'asc' },
          },
        },
      });

      if (workflow) {
        return workflow;
      }
    }

    // 如果没有找到，查找通用默认工作流
    const workflow = await prisma.reviewWorkflowConfig.findFirst({
      where: {
        documentType: null,
        isDefault: true,
        isEnabled: true,
      },
      include: {
        nodes: {
          orderBy: { nodeOrder: 'asc' },
        },
      },
    });

    return workflow;
  }

  /**
   * 启用/禁用工作流
   */
  static async toggleEnabled(id: string, isEnabled: boolean): Promise<ReviewWorkflowConfig> {
    const prisma = getPrisma();

    const workflow = await prisma.reviewWorkflowConfig.update({
      where: { id },
      data: { isEnabled },
      include: {
        nodes: {
          orderBy: { nodeOrder: 'asc' },
        },
      },
    });

    return workflow;
  }

  /**
   * 设置为默认工作流
   */
  static async setDefault(id: string): Promise<ReviewWorkflowConfig> {
    const prisma = getPrisma();

    const workflow = await prisma.reviewWorkflowConfig.findUnique({
      where: { id },
    });

    if (!workflow) {
      throw new NotFoundError('工作流不存在');
    }

    // 取消同类型的其他默认工作流
    await prisma.reviewWorkflowConfig.updateMany({
      where: {
        documentType: workflow.documentType,
        isDefault: true,
        id: { not: id },
      },
      data: { isDefault: false },
    });

    // 设置为默认
    const updated = await prisma.reviewWorkflowConfig.update({
      where: { id },
      data: { isDefault: true },
      include: {
        nodes: {
          orderBy: { nodeOrder: 'asc' },
        },
      },
    });

    return updated;
  }
}
