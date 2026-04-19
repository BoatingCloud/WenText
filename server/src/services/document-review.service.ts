import { getPrisma } from '../config/database.js';
import type {
  DocumentReview,
  DocumentReviewType,
  ReviewStatus,
  Prisma,
} from '@prisma/client';
import { NotFoundError, AuthorizationError, ConflictError } from '../utils/errors.js';
import { UserDataPermissionService } from './user-data-permission.service.js';
import { DepartmentService } from './department.service.js';
import { DocumentReviewPermissionService } from './document-review-permission.service.js';
import { ReviewWorkflowService } from './review-workflow.service.js';

export interface CreateDocumentReviewInput {
  title: string;
  documentType: DocumentReviewType;
  departmentId?: string;
  companyCode?: string;
  workflowId?: string;
}

export interface UpdateDocumentReviewInput {
  title?: string;
  documentType?: DocumentReviewType;
  departmentId?: string;
  companyCode?: string;
  workflowId?: string;
}

export interface ListDocumentReviewsParams {
  page?: number;
  pageSize?: number;
  status?: ReviewStatus;
  documentType?: DocumentReviewType;
  initiatorId?: string;
  companyCode?: string;
  startDate?: Date;
  endDate?: Date;
}

export class DocumentReviewService {
  /**
   * 创建文档审查
   */
  static async create(
    userId: string,
    input: CreateDocumentReviewInput
  ): Promise<DocumentReview> {
    const prisma = getPrisma();
    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        documentReviewScopes: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );
    const isSystemAdmin = permissions.includes('system:manage');

    // 如果没有指定公司代码，使用用户的第一个文档审查公司范围
    let companyCode = input.companyCode;
    if (!companyCode && user.documentReviewScopes.length > 0) {
      companyCode = user.documentReviewScopes[0].companyCode;
    }

    // 非系统管理员需验证公司访问权限
    if (!isSystemAdmin && companyCode) {
      const hasAccess = user.documentReviewScopes.some(
        (s) => s.companyCode === companyCode
      );
      if (!hasAccess) {
        throw new AuthorizationError('无权访问该公司的文档审查数据');
      }
    }

    // 如果没有指定部门，使用用户的部门
    const departmentId = input.departmentId || user.departmentId;

    // 获取工作流：优先使用指定的，否则获取默认工作流
    let workflowId = input.workflowId;
    if (!workflowId) {
      const defaultWorkflow = await ReviewWorkflowService.getDefault(input.documentType);
      if (defaultWorkflow) {
        workflowId = defaultWorkflow.id;
      }
    }

    // 创建审查记录
    const review = await prisma.documentReview.create({
      data: {
        title: input.title,
        documentType: input.documentType,
        initiatorId: userId,
        departmentId,
        companyCode,
        workflowId,
        status: 'DRAFT',
      },
      include: {
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        department: true,
        workflow: {
          include: {
            nodes: true,
          },
        },
      },
    });

    // 获取部门完整路径
    const departmentFullPath = review.departmentId
      ? await DepartmentService.getDepartmentFullPath(review.departmentId)
      : undefined;

    return {
      ...review,
      departmentFullPath,
    } as any;
  }

  /**
   * 获取文档审查列表
   */
  static async list(
    userId: string,
    params: ListDocumentReviewsParams
  ): Promise<{ data: DocumentReview[]; total: number }> {
    const prisma = getPrisma();
    const {
      page = 1,
      pageSize = 20,
      status,
      documentType,
      initiatorId,
      companyCode,
      startDate,
      endDate,
    } = params;

    // 获取用户权限
    const user = await prisma.user.findUnique({
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
        department: true,
      },
    });

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    // 获取用户的所有权限代码
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );

    // 构建查询条件
    const whereConditions: Prisma.DocumentReviewWhereInput[] = [];

    // 系统管理员可以查看所有审查,跳过公司范围和数据权限过滤
    const isSystemAdmin = permissions.includes('system:manage');
    const hasViewAll = permissions.includes('doc-review:view-all');
    const hasViewDept = permissions.includes('doc-review:view-dept');
    const hasViewOwn = permissions.includes('doc-review:view');

    // 数据权限过滤（按优先级处理）
    if (isSystemAdmin || hasViewAll) {
      // 系统管理员或有查看所有权限：可查看所有数据
      // 如果配置了公司范围，按公司范围过滤；否则查看所有
      if (!isSystemAdmin) {
        const scopesResult = await DocumentReviewPermissionService.getCompanyScopes(userId);
        if (!scopesResult.isAllCompanies && scopesResult.companyCodes.length > 0) {
          whereConditions.push({
            companyCode: { in: scopesResult.companyCodes },
          });
        }
        // 如果 isAllCompanies 为 true 或没有配置公司范围，则不添加过滤条件，查看所有
      }
    } else if (hasViewDept) {
      // 部门权限：只能查看本部门的数据
      whereConditions.push({
        OR: [
          { initiatorId: userId }, // 自己发起的
          { departmentId: user.departmentId }, // 本部门的
          {
            approvalRecords: {
              some: { approverId: userId },
            },
          }, // 待自己审批的
        ],
      });
    } else if (hasViewOwn) {
      // 只能查看自己的
      whereConditions.push({
        OR: [
          { initiatorId: userId }, // 自己发起的
          {
            approvalRecords: {
              some: { approverId: userId },
            },
          }, // 待自己审批的
        ],
      });
    } else {
      // 无权限
      return { data: [], total: 0 };
    }

    // 3. 其他筛选条件
    if (status) {
      whereConditions.push({ status });
    }
    if (documentType) {
      whereConditions.push({ documentType });
    }
    if (initiatorId) {
      whereConditions.push({ initiatorId });
    }
    if (companyCode) {
      whereConditions.push({ companyCode });
    }
    if (startDate || endDate) {
      whereConditions.push({
        createdAt: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      });
    }

    const where: Prisma.DocumentReviewWhereInput = {
      AND: whereConditions,
    };

    // 调试日志
    console.log('[DEBUG] Document Review List Query:', JSON.stringify({
      userId,
      isSystemAdmin,
      permissions: permissions.filter(p => p.startsWith('doc-review:')),
      whereConditions: whereConditions.length,
      where,
    }, null, 2));

    // 查询数据
    const [data, total] = await Promise.all([
      prisma.documentReview.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          initiator: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          department: true,
          _count: {
            select: {
              attachments: true,
              annotations: true,
              approvalRecords: true,
            },
          },
        },
      }),
      prisma.documentReview.count({ where }),
    ]);

    // 批量获取部门完整路径
    const departmentIds = data
      .map((item) => item.departmentId)
      .filter((id): id is string => !!id);
    const departmentPathMap = await DepartmentService.getDepartmentsFullPath(departmentIds);

    // 为每个审查记录添加部门完整路径
    const dataWithPath = data.map((item) => ({
      ...item,
      departmentFullPath: item.departmentId ? departmentPathMap.get(item.departmentId) || item.department?.name : undefined,
    }));

    return { data: dataWithPath as any, total };
  }

  /**
   * 获取文档审查详情
   */
  static async getById(userId: string, reviewId: string): Promise<DocumentReview> {
    const prisma = getPrisma();
    const review = await prisma.documentReview.findUnique({
      where: { id: reviewId },
      include: {
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        department: true,
        workflow: {
          include: {
            nodes: true,
          },
        },
        attachments: {
          include: {
            uploader: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        approvalRecords: {
          include: {
            approver: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        annotations: {
          include: {
            annotator: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            comments: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatar: true,
                  },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!review) {
      throw new NotFoundError('审查记录不存在');
    }

    // 检查权限
    await this.checkViewPermission(userId, review);

    // 获取部门完整路径
    const departmentFullPath = review.departmentId
      ? await DepartmentService.getDepartmentFullPath(review.departmentId)
      : undefined;

    return {
      ...review,
      departmentFullPath,
    } as any;
  }

  /**
   * 更新文档审查
   */
  static async update(
    userId: string,
    reviewId: string,
    input: UpdateDocumentReviewInput
  ): Promise<DocumentReview> {
    const prisma = getPrisma();
    // 检查权限
    await this.checkEditPermission(userId, reviewId);

    const review = await prisma.documentReview.update({
      where: { id: reviewId },
      data: input,
      include: {
        initiator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        department: true,
        workflow: {
          include: {
            nodes: true,
          },
        },
      },
    });

    // 获取部门完整路径
    const departmentFullPath = review.departmentId
      ? await DepartmentService.getDepartmentFullPath(review.departmentId)
      : undefined;

    return {
      ...review,
      departmentFullPath,
    } as any;
  }

  /**
   * 删除文档审查（仅草稿状态）
   */
  static async delete(userId: string, reviewId: string): Promise<void> {
    const prisma = getPrisma();
    const review = await prisma.documentReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundError('审查记录不存在');
    }

    // 检查状态
    if (review.status !== 'DRAFT') {
      throw new ConflictError('只能删除草稿状态的审查');
    }

    // 检查权限
    const user = await prisma.user.findUnique({
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

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );

    // 系统管理员可以删除所有审查
    if (permissions.includes('system:manage')) {
      await prisma.documentReview.delete({
        where: { id: reviewId },
      });
      return;
    }

    const isInitiator = review.initiatorId === userId;

    if (
      !(
        (isInitiator && permissions.includes('doc-review:delete-own')) ||
        permissions.includes('doc-review:delete')
      )
    ) {
      throw new AuthorizationError('无权删除此审查');
    }

    // 删除审查记录（级联删除附件、标注等）
    await prisma.documentReview.delete({
      where: { id: reviewId },
    });
  }

  /**
   * 检查查看权限
   */
  private static async checkViewPermission(
    userId: string,
    review: DocumentReview
  ): Promise<void> {
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
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
        department: true,
      },
    });

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );

    // 系统管理员可以查看所有审查
    if (permissions.includes('system:manage')) {
      return;
    }

    const hasViewAll = permissions.includes('doc-review:view-all');
    const hasViewDept = permissions.includes('doc-review:view-dept');
    const hasViewOwn = permissions.includes('doc-review:view');

    // 如果有 view-all 权限，检查公司范围
    if (hasViewAll) {
      const scopesResult = await DocumentReviewPermissionService.getCompanyScopes(userId);
      if (!scopesResult.isAllCompanies && review.companyCode) {
        if (!scopesResult.companyCodes.includes(review.companyCode)) {
          throw new AuthorizationError('无权查看此审查');
        }
      }
      return;
    }

    // 部门权限：只能查看本部门或自己发起的
    if (hasViewDept) {
      if (review.initiatorId === userId || review.departmentId === user.departmentId) {
        return;
      }
      // 检查是否是审批人
      const isApprover = await prisma.reviewApprovalRecord.findFirst({
        where: { reviewId: review.id, approverId: userId },
      });
      if (isApprover) {
        return;
      }
      throw new AuthorizationError('无权查看此审查');
    }

    // 个人权限：只能查看自己发起的
    if (hasViewOwn) {
      if (review.initiatorId === userId) {
        return;
      }
      // 检查是否是审批人
      const isApprover = await prisma.reviewApprovalRecord.findFirst({
        where: { reviewId: review.id, approverId: userId },
      });
      if (isApprover) {
        return;
      }
      throw new AuthorizationError('无权查看此审查');
    }

    throw new AuthorizationError('无权查看此审查');
  }

  /**
   * 检查编辑权限
   */
  private static async checkEditPermission(
    userId: string,
    reviewId: string
  ): Promise<void> {
    const prisma = getPrisma();
    const review = await prisma.documentReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundError('审查记录不存在');
    }

    const user = await prisma.user.findUnique({
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

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );

    // 系统管理员可以编辑所有审查
    if (permissions.includes('system:manage')) {
      return;
    }

    // 检查是否是发起人
    const isInitiator = review.initiatorId === userId;

    // 检查状态
    if (review.status !== 'DRAFT') {
      throw new ConflictError('只能编辑草稿状态的审查');
    }

    // 检查权限
    if (isInitiator && permissions.includes('doc-review:edit-own')) {
      return;
    }

    if (permissions.includes('doc-review:edit')) {
      return;
    }

    throw new AuthorizationError('无权编辑此审查');
  }

  /**
   * 更新AI审查状态
   */
  static async updateAIReviewStatus(
    reviewId: string,
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  ): Promise<void> {
    const prisma = getPrisma();

    await prisma.documentReview.update({
      where: { id: reviewId },
      data: { aiReviewStatus: status },
    });
  }

  /**
   * 上传附件
   */
  static async uploadAttachment(
    userId: string,
    reviewId: string,
    file: {
      fileName: string;
      fileExtension?: string;
      fileSize: number;
      mimeType?: string;
      storagePath: string;
      md5: string;
    }
  ) {
    const prisma = getPrisma();

    // 检查审查记录是否存在
    const review = await prisma.documentReview.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundError('审查记录不存在');
    }

    // 获取用户权限
    const user = await prisma.user.findUnique({
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

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );

    // 系统管理员或有上传权限的用户可以上传
    const canUpload =
      permissions.includes('system:manage') ||
      permissions.includes('doc-review:upload-attachment') ||
      (review.initiatorId === userId && permissions.includes('doc-review:edit-own'));

    if (!canUpload) {
      throw new AuthorizationError('无权上传附件');
    }

    // 创建附件记录
    return prisma.documentReviewAttachment.create({
      data: {
        reviewId,
        fileName: file.fileName,
        fileExtension: file.fileExtension,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        storagePath: file.storagePath,
        md5: file.md5,
        uploaderId: userId,
      },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  }

  /**
   * 删除附件
   */
  static async deleteAttachment(
    userId: string,
    reviewId: string,
    attachmentId: string
  ) {
    const prisma = getPrisma();

    // 检查附件是否存在
    const attachment = await prisma.documentReviewAttachment.findUnique({
      where: { id: attachmentId },
      include: {
        review: true,
      },
    });

    if (!attachment) {
      throw new NotFoundError('附件不存在');
    }

    if (attachment.reviewId !== reviewId) {
      throw new ConflictError('附件不属于此审查记录');
    }

    // 获取用户权限
    const user = await prisma.user.findUnique({
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

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );

    // 系统管理员或有删除权限的用户可以删除
    const canDelete =
      permissions.includes('system:manage') ||
      permissions.includes('doc-review:delete-attachment') ||
      (attachment.review.initiatorId === userId && permissions.includes('doc-review:edit-own'));

    if (!canDelete) {
      throw new AuthorizationError('无权删除附件');
    }

    // 删除附件记录
    await prisma.documentReviewAttachment.delete({
      where: { id: attachmentId },
    });

    // TODO: 删除物理文件
  }

  /**
   * 获取附件列表
   */
  static async getAttachments(userId: string, reviewId: string) {
    const prisma = getPrisma();

    // 检查权限
    await this.getById(userId, reviewId);

    return prisma.documentReviewAttachment.findMany({
      where: { reviewId },
      include: {
        uploader: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * 提交审批
   */
  static async submitForApproval(userId: string, reviewId: string): Promise<DocumentReview> {
    const prisma = getPrisma();

    const review = await prisma.documentReview.findUnique({
      where: { id: reviewId },
      include: {
        attachments: true,
        workflow: { include: { nodes: { orderBy: { nodeOrder: 'asc' } } } },
      },
    });

    if (!review) {
      throw new NotFoundError('审查记录不存在');
    }

    if (review.initiatorId !== userId) {
      throw new AuthorizationError('只有发起人可以提交审批');
    }

    if (review.status !== 'DRAFT') {
      throw new ConflictError('只能提交草稿状态的审查');
    }

    if (review.attachments.length === 0) {
      throw new ConflictError('请先上传附件');
    }

    // 如果没有配置工作流，直接通过
    if (!review.workflow || review.workflow.nodes.length === 0) {
      const updated = await prisma.documentReview.update({
        where: { id: reviewId },
        data: {
          status: 'APPROVED',
          completedAt: new Date(),
        },
        include: {
          initiator: { select: { id: true, name: true, email: true, avatar: true } },
          department: true,
          workflow: { include: { nodes: true } },
        },
      });
      return updated;
    }

    // 提交到第一个审批节点
    const firstNode = review.workflow.nodes[0];
    const updated = await prisma.documentReview.update({
      where: { id: reviewId },
      data: {
        status: 'PENDING',
        currentNodeOrder: firstNode.nodeOrder,
      },
      include: {
        initiator: { select: { id: true, name: true, email: true, avatar: true } },
        department: true,
        workflow: { include: { nodes: true } },
      },
    });

    // 通知审批人
    await this.notifyNodeApprovers(firstNode, reviewId, review.title);

    return updated;
  }

  /**
   * 审批通过
   */
  static async approve(
    userId: string,
    reviewId: string,
    comment?: string,
    signatureUrl?: string
  ): Promise<DocumentReview> {
    const prisma = getPrisma();

    const review = await prisma.documentReview.findUnique({
      where: { id: reviewId },
      include: {
        workflow: { include: { nodes: { orderBy: { nodeOrder: 'asc' } } } },
      },
    });

    if (!review) {
      throw new NotFoundError('审查记录不存在');
    }

    if (!['PENDING', 'IN_PROGRESS'].includes(review.status)) {
      throw new ConflictError('当前状态不允许审批');
    }

    // 找到当前审批节点
    const currentNode = review.workflow?.nodes.find(
      (n) => n.nodeOrder === review.currentNodeOrder
    );

    if (!currentNode) {
      throw new ConflictError('未找到当前审批节点');
    }

    // 验证审批人权限
    await this.validateApprover(currentNode, userId);

    // 创建审批记录
    await prisma.reviewApprovalRecord.create({
      data: {
        reviewId,
        nodeOrder: currentNode.nodeOrder,
        nodeName: currentNode.name,
        approverId: userId,
        action: 'APPROVE',
        comment,
        signatureUrl,
      },
    });

    // 清除审批待办
    await this.clearApprovalTodos(reviewId);

    // 检查是否还有下一个节点
    const nextNode = review.workflow?.nodes.find(
      (n) => n.nodeOrder > currentNode.nodeOrder
    );

    let updated: DocumentReview;

    if (nextNode) {
      // 进入下一个审批节点
      updated = await prisma.documentReview.update({
        where: { id: reviewId },
        data: {
          status: 'IN_PROGRESS',
          currentNodeOrder: nextNode.nodeOrder,
        },
        include: {
          initiator: { select: { id: true, name: true, email: true, avatar: true } },
          department: true,
          workflow: { include: { nodes: true } },
        },
      });

      // 通知下一个节点的审批人
      await this.notifyNodeApprovers(nextNode, reviewId, review.title);
    } else {
      // 所有节点审批完成
      updated = await prisma.documentReview.update({
        where: { id: reviewId },
        data: {
          status: 'APPROVED',
          completedAt: new Date(),
        },
        include: {
          initiator: { select: { id: true, name: true, email: true, avatar: true } },
          department: true,
          workflow: { include: { nodes: true } },
        },
      });
    }

    return updated;
  }

  /**
   * 审批驳回
   */
  static async reject(
    userId: string,
    reviewId: string,
    comment: string,
    signatureUrl?: string
  ): Promise<DocumentReview> {
    const prisma = getPrisma();

    if (!comment) {
      throw new ConflictError('驳回时必须填写意见');
    }

    const review = await prisma.documentReview.findUnique({
      where: { id: reviewId },
      include: {
        workflow: { include: { nodes: { orderBy: { nodeOrder: 'asc' } } } },
      },
    });

    if (!review) {
      throw new NotFoundError('审查记录不存在');
    }

    if (!['PENDING', 'IN_PROGRESS'].includes(review.status)) {
      throw new ConflictError('当前状态不允许驳回');
    }

    // 找到当前审批节点
    const currentNode = review.workflow?.nodes.find(
      (n) => n.nodeOrder === review.currentNodeOrder
    );

    if (!currentNode) {
      throw new ConflictError('未找到当前审批节点');
    }

    // 验证审批人权限
    await this.validateApprover(currentNode, userId);

    // 创建审批记录
    await prisma.reviewApprovalRecord.create({
      data: {
        reviewId,
        nodeOrder: currentNode.nodeOrder,
        nodeName: currentNode.name,
        approverId: userId,
        action: 'REJECT',
        comment,
        signatureUrl,
      },
    });

    // 清除审批待办
    await this.clearApprovalTodos(reviewId);

    // 更新状态为已驳回
    const updated = await prisma.documentReview.update({
      where: { id: reviewId },
      data: {
        status: 'REJECTED',
        completedAt: new Date(),
      },
      include: {
        initiator: { select: { id: true, name: true, email: true, avatar: true } },
        department: true,
        workflow: { include: { nodes: true } },
      },
    });

    return updated;
  }

  /**
   * 验证审批人权限
   */
  private static async validateApprover(
    node: { approverType: string; approverValue: string | null },
    approverId: string
  ): Promise<void> {
    const prisma = getPrisma();

    switch (node.approverType) {
      case 'USER':
        if (node.approverValue !== approverId) {
          throw new AuthorizationError('您不是当前节点指定的审批人');
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
          throw new AuthorizationError('您不具有当前节点要求的审批角色');
        }
        break;
      }
      case 'DEPARTMENT_HEAD':
        // 部门负责人类型暂不支持，允许通过
        break;
      default:
        throw new AuthorizationError('未知的审批人类型');
    }
  }

  /**
   * 通知审批人
   */
  private static async notifyNodeApprovers(
    node: { approverType: string; approverValue: string | null; name: string },
    reviewId: string,
    reviewTitle: string
  ): Promise<void> {
    const prisma = getPrisma();
    const { ApprovalTodoService } = await import('./approval-todo.service.js');
    const title = `文档审查待办：${reviewTitle}（${node.name}）`;

    switch (node.approverType) {
      case 'USER':
        if (node.approverValue) {
          await ApprovalTodoService.create(node.approverValue, 'DOC_REVIEW_APPROVAL', reviewId, title);
        }
        break;
      case 'ROLE': {
        const usersWithRole = await prisma.userRole.findMany({
          where: { role: { code: node.approverValue || '' } },
          select: { userId: true },
        });
        for (const ur of usersWithRole) {
          await ApprovalTodoService.create(ur.userId, 'DOC_REVIEW_APPROVAL', reviewId, title);
        }
        break;
      }
      case 'DEPARTMENT_HEAD':
        // 部门负责人类型暂不支持
        break;
    }
  }

  /**
   * 清除审批待办
   */
  private static async clearApprovalTodos(reviewId: string): Promise<void> {
    const { ApprovalTodoService } = await import('./approval-todo.service.js');
    await ApprovalTodoService.completeByResource('DOC_REVIEW_APPROVAL', reviewId);
  }

  /**
   * 获取待我审批的列表
   */
  static async getPendingApprovals(userId: string): Promise<DocumentReview[]> {
    const prisma = getPrisma();

    // 获取用户的角色
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      return [];
    }

    const roleCodes = user.roles.map((ur) => ur.role.code);

    // 查询待审批的文档
    const reviews = await prisma.documentReview.findMany({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        workflow: {
          nodes: {
            some: {
              OR: [
                { approverType: 'USER', approverValue: userId },
                { approverType: 'ROLE', approverValue: { in: roleCodes } },
              ],
            },
          },
        },
      },
      include: {
        initiator: { select: { id: true, name: true, email: true, avatar: true } },
        department: true,
        workflow: { include: { nodes: { orderBy: { nodeOrder: 'asc' } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 过滤出当前节点需要该用户审批的记录
    return reviews.filter((review) => {
      const currentNode = review.workflow?.nodes.find(
        (n) => n.nodeOrder === review.currentNodeOrder
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
  }
}

