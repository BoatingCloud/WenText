import { getPrisma } from '../config/database.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';
import { BorrowWorkflowService } from './borrow-workflow.service.js';
import { ApprovalTodoService } from './approval-todo.service.js';
import { UserDataPermissionService } from './user-data-permission.service.js';
import type { BorrowRequestStatus, Prisma } from '@prisma/client';

export interface CreateBorrowRequestInput {
  archiveId: string;
  applicantId: string;
  workflowId?: string;
  borrowReason?: string;
  expectedBorrowAt?: Date;
  expectedReturnAt?: Date;
}

export interface BorrowRequestQueryOptions {
  page?: number;
  pageSize?: number;
  status?: BorrowRequestStatus;
  archiveId?: string;
  applicantId?: string;
  viewerId?: string;
}

const borrowRequestInclude = {
  archive: {
    select: { id: true, title: true, archiveNo: true, shelfLocation: true, status: true },
  },
  applicant: {
    select: { id: true, name: true, username: true },
  },
  workflow: {
    select: { id: true, name: true },
  },
  approvalRecords: {
    include: {
      approver: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.BorrowRequestInclude;

export class BorrowRequestService {
  private static async buildRelatedWhere(viewerId: string): Promise<Prisma.BorrowRequestWhereInput | null> {
    const prisma = getPrisma();
    const isSystemAdmin = await UserDataPermissionService.isSystemAdmin(viewerId);
    if (isSystemAdmin) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: viewerId },
      include: {
        roles: {
          include: {
            role: {
              select: { code: true },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('用户');
    }

    const roleCodes = user.roles.map((ur) => ur.role.code);
    const relatedOr: Prisma.BorrowRequestWhereInput[] = [
      { applicantId: viewerId },
      { approvalRecords: { some: { approverId: viewerId } } },
      {
        workflow: {
          is: {
            nodes: {
              some: {
                approverType: 'USER',
                approverValue: viewerId,
              },
            },
          },
        },
      },
    ];

    if (roleCodes.length > 0) {
      relatedOr.push({
        workflow: {
          is: {
            nodes: {
              some: {
                approverType: 'ROLE',
                approverValue: { in: roleCodes },
              },
            },
          },
        },
      });
    }

    return { OR: relatedOr };
  }

  /**
   * 创建借阅申请
   */
  static async createRequest(input: CreateBorrowRequestInput) {
    const prisma = getPrisma();

    // 校验档案存在且状态可借阅
    const archive = await prisma.physicalArchive.findUnique({
      where: { id: input.archiveId },
      select: { id: true, title: true, archiveNo: true, status: true, workflowStatus: true },
    });
    if (!archive) {
      throw new NotFoundError('实体档案');
    }
    if (archive.status !== 'IN_STOCK') {
      throw new ConflictError('该档案当前不在库，无法申请借阅');
    }
    if (archive.workflowStatus !== 'ARCHIVED' && archive.workflowStatus !== 'RETURNED') {
      throw new ConflictError('该档案尚未归档完成，无法申请借阅');
    }

    // 检查是否已有进行中的借阅申请
    const existingRequest = await prisma.borrowRequest.findFirst({
      where: {
        archiveId: input.archiveId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
    });
    if (existingRequest) {
      throw new ConflictError('该档案已有进行中的借阅申请');
    }

    // 获取工作流
    let workflowId = input.workflowId;
    if (!workflowId) {
      const defaultWorkflow = await BorrowWorkflowService.getDefault();
      if (!defaultWorkflow) {
        throw new ValidationError('未配置默认借阅工作流，请联系管理员');
      }
      workflowId = defaultWorkflow.id;
    }

    const workflow = await prisma.borrowWorkflowConfig.findUnique({
      where: { id: workflowId },
      include: { nodes: { orderBy: { nodeOrder: 'asc' } } },
    });
    if (!workflow || !workflow.isEnabled) {
      throw new ValidationError('工作流不可用');
    }
    if (workflow.nodes.length === 0) {
      throw new ValidationError('工作流未配置审批节点');
    }

    const request = await prisma.borrowRequest.create({
      data: {
        archiveId: input.archiveId,
        applicantId: input.applicantId,
        workflowId,
        status: 'PENDING',
        borrowReason: input.borrowReason,
        expectedBorrowAt: input.expectedBorrowAt,
        expectedReturnAt: input.expectedReturnAt,
        currentNodeOrder: 1,
      },
      include: borrowRequestInclude,
    });

    // 推送第一个节点审批待办
    const firstNode = workflow.nodes[0];
    await this.notifyNodeApprovers(firstNode, request.id, archive.title);

    return request;
  }

  /**
   * 审批通过
   */
  static async approveNode(
    requestId: string,
    approverId: string,
    comment?: string,
    signatureUrl?: string
  ) {
    const prisma = getPrisma();

    const request = await prisma.borrowRequest.findUnique({
      where: { id: requestId },
      include: {
        workflow: { include: { nodes: { orderBy: { nodeOrder: 'asc' } } } },
        archive: { select: { id: true, title: true, status: true, workflowStatus: true } },
      },
    });
    if (!request) {
      throw new NotFoundError('借阅申请');
    }
    if (request.status !== 'PENDING' && request.status !== 'IN_PROGRESS') {
      throw new ConflictError('该申请当前状态不可审批');
    }

    const currentNode = request.workflow?.nodes.find(
      (n) => n.nodeOrder === request.currentNodeOrder
    );
    if (!currentNode) {
      throw new ValidationError('未找到当前审批节点');
    }

    // 校验审批人权限
    await this.validateApprover(currentNode, approverId);

    // 创建审批记录
    await prisma.borrowApprovalRecord.create({
      data: {
        requestId,
        nodeOrder: currentNode.nodeOrder,
        nodeName: currentNode.name,
        approverId,
        action: 'APPROVE',
        comment,
        signatureUrl,
      },
    });

    const totalNodes = request.workflow?.nodes.length || 0;
    const nextNodeOrder = request.currentNodeOrder + 1;

    if (nextNodeOrder > totalNodes) {
      // 所有节点通过，完成审批 → 自动执行借阅
      const updated = await prisma.borrowRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          completedAt: new Date(),
        },
        include: borrowRequestInclude,
      });

      // 自动执行借阅（如果档案仍在库）
      if (request.archive.status === 'IN_STOCK') {
        await prisma.physicalArchive.update({
          where: { id: request.archiveId },
          data: {
            status: 'BORROWED',
            workflowStatus: 'BORROWED',
            borrower: updated.applicant.name,
            borrowedAt: new Date(),
            borrowRemark: `工作流审批借阅 - ${request.borrowReason || ''}`,
          },
        });

        // 创建借阅记录
        await prisma.physicalArchiveBorrowRecord.create({
          data: {
            archiveId: request.archiveId,
            action: 'BORROW',
            borrower: updated.applicant.name,
            borrowedAt: new Date(),
            dueAt: request.expectedReturnAt,
            remark: `工作流审批借阅 - ${request.borrowReason || ''}`,
            operatorId: approverId,
          },
        });
      }

      // 通知申请人
      await ApprovalTodoService.create(
        request.applicantId,
        'BORROW_APPROVED',
        requestId,
        `您的借阅申请已通过：${request.archive.title}`
      );

      return updated;
    } else {
      // 推进到下一节点
      const updated = await prisma.borrowRequest.update({
        where: { id: requestId },
        data: {
          status: 'IN_PROGRESS',
          currentNodeOrder: nextNodeOrder,
        },
        include: borrowRequestInclude,
      });

      // 推送下一节点审批待办
      const nextNode = request.workflow!.nodes.find((n) => n.nodeOrder === nextNodeOrder);
      if (nextNode) {
        await this.notifyNodeApprovers(nextNode, requestId, request.archive.title);
      }

      return updated;
    }
  }

  /**
   * 审批驳回
   */
  static async rejectNode(
    requestId: string,
    approverId: string,
    comment: string,
    signatureUrl?: string
  ) {
    const prisma = getPrisma();

    const request = await prisma.borrowRequest.findUnique({
      where: { id: requestId },
      include: {
        workflow: { include: { nodes: { orderBy: { nodeOrder: 'asc' } } } },
        archive: { select: { id: true, title: true } },
      },
    });
    if (!request) {
      throw new NotFoundError('借阅申请');
    }
    if (request.status !== 'PENDING' && request.status !== 'IN_PROGRESS') {
      throw new ConflictError('该申请当前状态不可审批');
    }

    const currentNode = request.workflow?.nodes.find(
      (n) => n.nodeOrder === request.currentNodeOrder
    );
    if (!currentNode) {
      throw new ValidationError('未找到当前审批节点');
    }

    await this.validateApprover(currentNode, approverId);

    await prisma.borrowApprovalRecord.create({
      data: {
        requestId,
        nodeOrder: currentNode.nodeOrder,
        nodeName: currentNode.name,
        approverId,
        action: 'REJECT',
        comment,
        signatureUrl,
      },
    });

    const updated = await prisma.borrowRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        completedAt: new Date(),
      },
      include: borrowRequestInclude,
    });

    // 通知申请人
    await ApprovalTodoService.create(
      request.applicantId,
      'BORROW_REJECTED',
      requestId,
      `您的借阅申请已被驳回：${request.archive.title}`
    );

    return updated;
  }

  /**
   * 取消申请
   */
  static async cancelRequest(requestId: string, applicantId: string) {
    const prisma = getPrisma();

    const request = await prisma.borrowRequest.findUnique({
      where: { id: requestId },
    });
    if (!request) {
      throw new NotFoundError('借阅申请');
    }
    if (request.applicantId !== applicantId) {
      throw new ConflictError('只有申请人才能取消申请');
    }
    if (request.status !== 'PENDING' && request.status !== 'IN_PROGRESS') {
      throw new ConflictError('该申请当前状态不可取消');
    }

    return prisma.borrowRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
      include: borrowRequestInclude,
    });
  }

  /**
   * 查询列表
   */
  static async findAll(options: BorrowRequestQueryOptions = {}) {
    const prisma = getPrisma();
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const andConditions: Prisma.BorrowRequestWhereInput[] = [];
    if (options.status) andConditions.push({ status: options.status });
    if (options.archiveId) andConditions.push({ archiveId: options.archiveId });
    if (options.applicantId) andConditions.push({ applicantId: options.applicantId });
    if (options.viewerId) {
      const relatedWhere = await this.buildRelatedWhere(options.viewerId);
      if (relatedWhere) {
        andConditions.push(relatedWhere);
      }
    }

    const where: Prisma.BorrowRequestWhereInput = andConditions.length > 0
      ? { AND: andConditions }
      : {};

    const [requests, total] = await Promise.all([
      prisma.borrowRequest.findMany({
        where,
        include: borrowRequestInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.borrowRequest.count({ where }),
    ]);

    return { requests, total, page, pageSize };
  }

  /**
   * 详情
   */
  static async findById(id: string, viewerId?: string) {
    const prisma = getPrisma();
    const andConditions: Prisma.BorrowRequestWhereInput[] = [{ id }];
    if (viewerId) {
      const relatedWhere = await this.buildRelatedWhere(viewerId);
      if (relatedWhere) {
        andConditions.push(relatedWhere);
      }
    }

    const request = await prisma.borrowRequest.findFirst({
      where: { AND: andConditions },
      include: {
        ...borrowRequestInclude,
        workflow: {
          include: { nodes: { orderBy: { nodeOrder: 'asc' } } },
        },
      },
    });
    if (!request) {
      throw new NotFoundError('借阅申请');
    }
    return request;
  }

  /**
   * 我的待审批
   */
  static async getMyPendingApprovals(userId: string, options: { page?: number; pageSize?: number } = {}) {
    const prisma = getPrisma();
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    // 获取用户的角色
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
      },
    });
    if (!user) {
      throw new NotFoundError('用户');
    }

    const roleCodes = user.roles.map((ur) => ur.role.code);

    // 查找所有 PENDING/IN_PROGRESS 的申请
    const allPending = await prisma.borrowRequest.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      include: {
        ...borrowRequestInclude,
        workflow: {
          include: { nodes: { orderBy: { nodeOrder: 'asc' } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 过滤出当前用户需要审批的
    const myPending = allPending.filter((req) => {
      const currentNode = req.workflow?.nodes.find(
        (n) => n.nodeOrder === req.currentNodeOrder
      );
      if (!currentNode) return false;

      switch (currentNode.approverType) {
        case 'USER':
          return currentNode.approverValue === userId;
        case 'ROLE':
          return roleCodes.includes(currentNode.approverValue || '');
        default:
          return false;
      }
    });

    const total = myPending.length;
    const paged = myPending.slice(skip, skip + pageSize);

    return { requests: paged, total, page, pageSize };
  }

  /**
   * 校验审批人
   */
  private static async validateApprover(
    node: { approverType: string; approverValue: string | null },
    approverId: string
  ) {
    const prisma = getPrisma();

    switch (node.approverType) {
      case 'USER':
        if (node.approverValue !== approverId) {
          throw new ConflictError('您不是当前节点指定的审批人');
        }
        break;
      case 'ROLE': {
        const hasRole = await prisma.userRole.findFirst({
          where: {
            userId: approverId,
            role: { code: node.approverValue || '' },
          },
        });
        if (!hasRole) {
          throw new ConflictError('您不具有当前节点要求的审批角色');
        }
        break;
      }
      default:
        // 对于其他类型暂允许通过
        break;
    }
  }

  /**
   * 推送审批待办
   */
  private static async notifyNodeApprovers(
    node: { approverType: string; approverValue: string | null; name: string },
    requestId: string,
    archiveTitle: string
  ) {
    const prisma = getPrisma();
    const title = `借阅审批待办：${archiveTitle}（${node.name}）`;

    switch (node.approverType) {
      case 'USER':
        if (node.approverValue) {
          await ApprovalTodoService.create(node.approverValue, 'BORROW_APPROVAL', requestId, title);
        }
        break;
      case 'ROLE': {
        const usersWithRole = await prisma.userRole.findMany({
          where: { role: { code: node.approverValue || '' } },
          select: { userId: true },
        });
        for (const ur of usersWithRole) {
          await ApprovalTodoService.create(ur.userId, 'BORROW_APPROVAL', requestId, title);
        }
        break;
      }
      default:
        break;
    }
  }
}
