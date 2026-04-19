import { getPrisma } from '../config/database.js';
import { NotFoundError, ConflictError, AuthorizationError } from '../utils/errors.js';
import { assertWorkflowTransition, assertInventoryTransition } from '../domain/physical-archive/state-machine.js';
import { normalizeFileSizeBytes, serializePhysicalArchive, serializePhysicalArchiveList } from './physical-archive.mapper.js';
import { UserDataPermissionService } from './user-data-permission.service.js';
import type { Prisma, PhysicalArchiveStatus, ArchiveWorkflowStatus, ArchiveVersionStatus } from '@prisma/client';

export interface CreatePhysicalArchiveInput {
  title: string;
  archiveNo: string;
  archiveCode?: string;
  subtitle?: string;
  categoryName?: string;
  categoryPath?: string;
  categoryId?: string;
  fondsName?: string;
  fondsCode?: string;
  year?: number;
  language?: string;
  carrierType?: string;
  archiveForm?: string;
  fileNo?: string;
  fileType?: string;
  responsibleParty?: string;
  responsibleCode?: string;
  filingDate?: Date;
  effectiveDate?: Date;
  invalidDate?: Date;
  shelfLocation: string;
  retentionPeriod?: string;
  securityLevel?: string;
  formedAt?: Date;
  expiresAt?: Date;
  copies?: number;
  pages?: number;
  attachmentCount?: number;
  summary?: string;
  keywords?: string[];
  subjectTerms?: string;
  documentGenre?: string;
  urgencyLevel?: string;
  workflowStatus?: ArchiveWorkflowStatus;
  filingDepartment?: string;
  responsibleUnit?: string;
  belongCategory?: string;
  transferDepartment?: string;
  transferPerson?: string;
  transferDate?: Date;
  receiver?: string;
  receiveDate?: Date;
  storageLocation?: string;
  shelfNo?: string;
  volumeNo?: string;
  itemNo?: string;
  controlMark?: string;
  appraisalStatus?: string;
  appraiser?: string;
  appraisalDate?: Date;
  boxNo?: string;
  status?: PhysicalArchiveStatus;
  borrower?: string;
  borrowedAt?: Date;
  borrowRemark?: string;
  tags?: string[];
  electronicFileId?: string;
  originalFileName?: string;
  fileExtension?: string;
  fileSizeBytes?: string | number | bigint;
  fileStoragePath?: string;
  storageMethod?: string;
  fileMd5?: string;
  ocrText?: string;
  thumbnailPath?: string;
  transferStatus?: string;
  digitizationStatus?: string;
  versionNo?: string;
  revisionNo?: number;
  previousVersionNo?: string;
  versionRemark?: string;
  versionStatus?: ArchiveVersionStatus;
  isCurrentVersion?: boolean;
  versionHistory?: string[];
  parentArchiveId?: string;
  rootArchiveId?: string;
  relatedArchiveIds?: string[];
  predecessorArchiveId?: string;
  successorArchiveId?: string;
  replacedArchiveId?: string;
  copiedFromArchiveId?: string;
  ownerName?: string;
  ownerDepartment?: string;
  accessLevel?: string;
  accessPolicy?: string;
  watermarkConfig?: string;
  encryptionAlgorithm?: string;
  encryptionStatus?: string;
  tamperProofHash?: string;
  creatorDepartment?: string;
  updatedById?: string;
  reviewer?: string;
  reviewedAt?: Date;
  reviewComment?: string;
  filer?: string;
  filedAt?: Date;
  destroyer?: string;
  destroyedAt?: Date;
  destroyReason?: string;
  lastAccessedBy?: string;
  lastAccessedAt?: Date;
  customText1?: string;
  customText2?: string;
  customText3?: string;
  customNumber?: number;
  customDate?: Date;
  extraJson?: Prisma.InputJsonValue;
  remark?: string;
  companyCode?: string;
  creatorId: string;
}

export interface UpdatePhysicalArchiveInput {
  title?: string;
  archiveNo?: string;
  archiveCode?: string;
  subtitle?: string;
  categoryName?: string;
  categoryPath?: string;
  categoryId?: string;
  fondsName?: string;
  fondsCode?: string;
  year?: number;
  language?: string;
  carrierType?: string;
  archiveForm?: string;
  fileNo?: string;
  fileType?: string;
  responsibleParty?: string;
  responsibleCode?: string;
  filingDate?: Date | null;
  effectiveDate?: Date | null;
  invalidDate?: Date | null;
  shelfLocation?: string;
  retentionPeriod?: string;
  securityLevel?: string;
  formedAt?: Date | null;
  expiresAt?: Date | null;
  copies?: number;
  pages?: number;
  attachmentCount?: number;
  summary?: string;
  keywords?: string[];
  subjectTerms?: string;
  documentGenre?: string;
  urgencyLevel?: string;
  workflowStatus?: ArchiveWorkflowStatus;
  filingDepartment?: string;
  responsibleUnit?: string;
  belongCategory?: string;
  transferDepartment?: string;
  transferPerson?: string;
  transferDate?: Date | null;
  receiver?: string;
  receiveDate?: Date | null;
  storageLocation?: string;
  shelfNo?: string;
  volumeNo?: string;
  itemNo?: string;
  controlMark?: string;
  appraisalStatus?: string;
  appraiser?: string;
  appraisalDate?: Date | null;
  boxNo?: string;
  status?: PhysicalArchiveStatus;
  borrower?: string;
  borrowedAt?: Date | null;
  borrowRemark?: string;
  tags?: string[];
  electronicFileId?: string;
  originalFileName?: string;
  fileExtension?: string;
  fileSizeBytes?: string | number | bigint;
  fileStoragePath?: string;
  storageMethod?: string;
  fileMd5?: string;
  ocrText?: string;
  thumbnailPath?: string;
  transferStatus?: string;
  digitizationStatus?: string;
  versionNo?: string;
  revisionNo?: number;
  previousVersionNo?: string;
  versionRemark?: string;
  versionStatus?: ArchiveVersionStatus;
  isCurrentVersion?: boolean;
  versionHistory?: string[];
  parentArchiveId?: string;
  rootArchiveId?: string;
  relatedArchiveIds?: string[];
  predecessorArchiveId?: string;
  successorArchiveId?: string;
  replacedArchiveId?: string;
  copiedFromArchiveId?: string;
  ownerName?: string;
  ownerDepartment?: string;
  accessLevel?: string;
  accessPolicy?: string;
  watermarkConfig?: string;
  encryptionAlgorithm?: string;
  encryptionStatus?: string;
  tamperProofHash?: string;
  creatorDepartment?: string;
  updatedById?: string;
  reviewer?: string;
  reviewedAt?: Date | null;
  reviewComment?: string;
  filer?: string;
  filedAt?: Date | null;
  destroyer?: string;
  destroyedAt?: Date | null;
  destroyReason?: string;
  lastAccessedBy?: string;
  lastAccessedAt?: Date | null;
  customText1?: string;
  customText2?: string;
  customText3?: string;
  customNumber?: number;
  customDate?: Date | null;
  extraJson?: Prisma.InputJsonValue;
  remark?: string;
  companyCode?: string | null;
}

export interface PhysicalArchiveQueryOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: PhysicalArchiveStatus;
  workflowStatus?: ArchiveWorkflowStatus;
  year?: number;
  categoryId?: string;
  includeDestroyed?: boolean;
  companyCode?: string;
  userId?: string;
}

export interface BorrowPhysicalArchiveInput {
  borrower: string;
  borrowedAt?: Date;
  dueAt?: Date;
  borrowRemark?: string;
}

export interface ReturnPhysicalArchiveInput {
  returnedAt?: Date;
  returnRemark?: string;
}

const physicalArchiveInclude = {
  creator: {
    select: {
      id: true,
      name: true,
      username: true,
    },
  },
} satisfies Prisma.PhysicalArchiveInclude;

export class PhysicalArchiveService {
  /**
   * 校验用户是否有权操作指定公司的档案。
   * 系统管理员不受限制；普通用户必须拥有该公司的数据权限。
   * companyCode 为 null/undefined 时视为"未分配公司"，所有有档案权限的用户可操作。
   */
  private static async assertCompanyAccess(userId: string, companyCode: string | null | undefined): Promise<void> {
    if (!companyCode) return; // 未分配公司的档案不做公司权限限制
    const ctx = await UserDataPermissionService.getAccessScopeContext(userId);
    if (ctx.isSystemAdmin) return;
    if (!ctx.archiveCompanyCodes.includes(companyCode)) {
      throw new AuthorizationError('无权操作该公司的档案');
    }
  }

  /**
   * 轻量级权限检查：只查询档案的 companyCode，不加载关联数据
   * 用于附件操作等场景，避免循环加载附件数据
   */
  static async checkArchiveAccess(archiveId: string, userId: string): Promise<void> {
    const prisma = getPrisma();
    const archive = await prisma.physicalArchive.findUnique({
      where: { id: archiveId },
      select: { id: true, companyCode: true },
    });

    if (!archive) {
      throw new NotFoundError('实体档案');
    }

    // 1. 校验公司权限
    await this.assertCompanyAccess(userId, archive.companyCode);

    // 2. 校验档案权限（白名单）
    const hasAccess = await UserDataPermissionService.checkPhysicalArchiveAccess(userId, archiveId);
    if (!hasAccess) {
      throw new AuthorizationError('无权访问该档案');
    }
  }

  static async create(input: CreatePhysicalArchiveInput) {
    const prisma = getPrisma();

    // 校验用户对目标公司的数据权限
    await this.assertCompanyAccess(input.creatorId, input.companyCode);

    const existing = await prisma.physicalArchive.findUnique({
      where: { archiveNo: input.archiveNo },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError('实体档案编号已存在');
    }

    const creator = await prisma.user.findUnique({
      where: { id: input.creatorId },
      select: {
        name: true,
        department: {
          select: {
            name: true,
          },
        },
      },
    });

    const filingDate =
      input.filingDate ||
      (input.workflowStatus === 'ARCHIVED' ? new Date() : undefined);

    const result = await prisma.physicalArchive.create({
      data: {
        ...input,
        fileSizeBytes: normalizeFileSizeBytes(input.fileSizeBytes),
        status: input.status || 'IN_STOCK',
        workflowStatus: input.workflowStatus || 'DRAFT',
        revisionNo: input.revisionNo || 1,
        versionNo: input.versionNo || 'V1.0',
        versionStatus: input.versionStatus || 'FINAL',
        isCurrentVersion: input.isCurrentVersion ?? true,
        copies: input.copies || 1,
        tags: input.tags || [],
        keywords: input.keywords || [],
        versionHistory: input.versionHistory || [],
        relatedArchiveIds: input.relatedArchiveIds || [],
        filingDate,
        ownerName: input.ownerName || creator?.name,
        ownerDepartment: input.ownerDepartment || creator?.department?.name,
        creatorDepartment: input.creatorDepartment || creator?.department?.name,
        borrowedAt: input.status === 'BORROWED' ? (input.borrowedAt || new Date()) : null,
      },
      include: physicalArchiveInclude,
    });

    return serializePhysicalArchive(result);
  }

  static async findById(id: string, userId?: string) {
    const prisma = getPrisma();
    const archive = await prisma.physicalArchive.findUnique({
      where: { id },
      include: {
        ...physicalArchiveInclude,
        attachments: {
          include: { uploader: { select: { id: true, name: true, username: true } } },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });

    if (!archive) {
      throw new NotFoundError('实体档案');
    }

    // 校验用户权限
    if (userId) {
      // 1. 校验公司权限
      await this.assertCompanyAccess(userId, archive.companyCode);

      // 2. 校验档案权限（白名单）
      const hasAccess = await UserDataPermissionService.checkPhysicalArchiveAccess(userId, id);
      if (!hasAccess) {
        throw new AuthorizationError('无权访问该档案');
      }
    }

    return serializePhysicalArchive(archive);
  }

  static async findAll(options: PhysicalArchiveQueryOptions = {}) {
    const prisma = getPrisma();
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;
    const andConditions: Prisma.PhysicalArchiveWhereInput[] = [];

    // 档案公司权限过滤
    if (options.userId) {
      const ctx = await UserDataPermissionService.getAccessScopeContext(options.userId);
      if (!ctx.isSystemAdmin) {
        // 使用档案公司权限过滤
        if (ctx.archiveCompanyCodes.length > 0) {
          andConditions.push({
            OR: [
              { companyCode: { in: ctx.archiveCompanyCodes } },
              { companyCode: null }, // 允许访问未分配公司的档案
            ],
          });
        } else {
          // 无任何档案公司权限，只能看到未分配公司的档案
          andConditions.push({ companyCode: null });
        }
      }
    }

    // 前端公司筛选
    if (options.companyCode) {
      if (options.companyCode === '__unassigned__') {
        andConditions.push({ companyCode: null });
      } else {
        andConditions.push({ companyCode: options.companyCode });
      }
    }

    // 默认排除已销毁记录
    if (!options.includeDestroyed) {
      andConditions.push({
        status: options.status || { not: 'DESTROYED' },
      });
    } else if (options.status) {
      andConditions.push({ status: options.status });
    }

    if (options.search) {
      andConditions.push({
        OR: [
          { title: { contains: options.search } },
          { archiveNo: { contains: options.search } },
          { archiveCode: { contains: options.search } },
          { fileNo: { contains: options.search } },
          { fileType: { contains: options.search } },
          { categoryName: { contains: options.search } },
          { categoryPath: { contains: options.search } },
          { belongCategory: { contains: options.search } },
          { responsibleParty: { contains: options.search } },
          { summary: { contains: options.search } },
          { subjectTerms: { contains: options.search } },
          { shelfLocation: { contains: options.search } },
        ],
      });
    }

    if (options.workflowStatus) {
      andConditions.push({ workflowStatus: options.workflowStatus });
    }

    if (typeof options.year === 'number' && !Number.isNaN(options.year)) {
      andConditions.push({ year: options.year });
    }

    if (options.categoryId) {
      andConditions.push({ categoryId: options.categoryId });
    }

    const where: Prisma.PhysicalArchiveWhereInput = andConditions.length > 0
      ? { AND: andConditions }
      : {};

    const [archives, total] = await Promise.all([
      prisma.physicalArchive.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          ...physicalArchiveInclude,
          _count: { select: { attachments: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.physicalArchive.count({ where }),
    ]);

    return {
      archives: serializePhysicalArchiveList(archives),
      total,
      page,
      pageSize,
    };
  }

  static async update(id: string, input: UpdatePhysicalArchiveInput, userId?: string) {
    const prisma = getPrisma();

    const exists = await prisma.physicalArchive.findUnique({
      where: { id },
      select: { id: true, status: true, workflowStatus: true, companyCode: true },
    });
    if (!exists) {
      throw new NotFoundError('实体档案');
    }

    // 校验用户对当前档案所属公司的数据权限
    if (userId) {
      await this.assertCompanyAccess(userId, exists.companyCode);
      // 如果修改了所属公司，也要校验新公司的权限
      if (input.companyCode !== undefined && input.companyCode !== exists.companyCode) {
        await this.assertCompanyAccess(userId, input.companyCode);
      }
    }

    if (input.archiveNo) {
      const duplicate = await prisma.physicalArchive.findFirst({
        where: {
          archiveNo: input.archiveNo,
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicate) {
        throw new ConflictError('实体档案编号已存在');
      }
    }

    // 状态机校验
    if (input.workflowStatus && input.workflowStatus !== exists.workflowStatus) {
      assertWorkflowTransition(exists.workflowStatus, input.workflowStatus);
    }
    if (input.status && input.status !== exists.status) {
      assertInventoryTransition(exists.status, input.status);
    }

    const normalizedInput: Prisma.PhysicalArchiveUpdateInput = {
      ...input,
      fileSizeBytes: input.fileSizeBytes !== undefined
        ? normalizeFileSizeBytes(input.fileSizeBytes)
        : undefined,
    };

    if (input.status === 'BORROWED') {
      normalizedInput.borrowedAt = input.borrowedAt || new Date();
    } else if (input.status) {
      normalizedInput.borrowedAt = null;
      normalizedInput.borrower = null;
      normalizedInput.borrowRemark = null;
    }

    if (input.workflowStatus === 'ARCHIVED' && !input.filingDate) {
      normalizedInput.filingDate = new Date();
    }

    const result = await prisma.physicalArchive.update({
      where: { id },
      data: normalizedInput,
      include: physicalArchiveInclude,
    });

    return serializePhysicalArchive(result);
  }

  /** 软删除：标记为 DESTROYED 状态 */
  static async remove(id: string, destroyReason?: string, operatorName?: string, userId?: string): Promise<void> {
    const prisma = getPrisma();

    const exists = await prisma.physicalArchive.findUnique({
      where: { id },
      select: { id: true, status: true, workflowStatus: true, companyCode: true },
    });
    if (!exists) {
      throw new NotFoundError('实体档案');
    }

    // 校验用户对该档案所属公司的数据权限
    if (userId) {
      await this.assertCompanyAccess(userId, exists.companyCode);
    }

    assertInventoryTransition(exists.status, 'DESTROYED');

    await prisma.physicalArchive.update({
      where: { id },
      data: {
        status: 'DESTROYED',
        workflowStatus: 'DESTROYED',
        destroyedAt: new Date(),
        destroyer: operatorName || undefined,
        destroyReason: destroyReason || '通过删除操作销毁',
      },
    });
  }

  /** 动作：提交审核 (DRAFT -> PENDING_REVIEW) */
  static async submitReview(id: string, comment?: string, userId?: string) {
    const prisma = getPrisma();
    const archive = await prisma.physicalArchive.findUnique({
      where: { id },
      select: { id: true, workflowStatus: true, companyCode: true },
    });
    if (!archive) throw new NotFoundError('实体档案');

    if (userId) {
      await this.assertCompanyAccess(userId, archive.companyCode);
    }

    assertWorkflowTransition(archive.workflowStatus, 'PENDING_REVIEW');

    const result = await prisma.physicalArchive.update({
      where: { id },
      data: {
        workflowStatus: 'PENDING_REVIEW',
        reviewComment: comment || null,
      },
      include: physicalArchiveInclude,
    });
    return serializePhysicalArchive(result);
  }

  /** 动作：审核通过归档 (PENDING_REVIEW -> ARCHIVED) */
  static async approveArchive(id: string, reviewerName: string, reviewComment?: string, userId?: string) {
    const prisma = getPrisma();
    const archive = await prisma.physicalArchive.findUnique({
      where: { id },
      select: { id: true, workflowStatus: true, companyCode: true },
    });
    if (!archive) throw new NotFoundError('实体档案');

    if (userId) {
      await this.assertCompanyAccess(userId, archive.companyCode);
    }

    assertWorkflowTransition(archive.workflowStatus, 'ARCHIVED');

    const now = new Date();
    const result = await prisma.physicalArchive.update({
      where: { id },
      data: {
        workflowStatus: 'ARCHIVED',
        reviewer: reviewerName,
        reviewedAt: now,
        reviewComment: reviewComment || '审核通过',
        filer: reviewerName,
        filedAt: now,
        filingDate: now,
      },
      include: physicalArchiveInclude,
    });
    return serializePhysicalArchive(result);
  }

  /** 动作：驳回到草稿 (PENDING_REVIEW -> DRAFT) */
  static async rejectReviewToDraft(id: string, reviewerName: string, reviewComment: string, userId?: string) {
    const prisma = getPrisma();
    const archive = await prisma.physicalArchive.findUnique({
      where: { id },
      select: { id: true, workflowStatus: true, companyCode: true },
    });
    if (!archive) throw new NotFoundError('实体档案');

    if (userId) {
      await this.assertCompanyAccess(userId, archive.companyCode);
    }

    assertWorkflowTransition(archive.workflowStatus, 'DRAFT');

    const result = await prisma.physicalArchive.update({
      where: { id },
      data: {
        workflowStatus: 'DRAFT',
        reviewer: reviewerName,
        reviewedAt: new Date(),
        reviewComment,
      },
      include: physicalArchiveInclude,
    });
    return serializePhysicalArchive(result);
  }

  /** 动作：标记修改 (ARCHIVED -> MODIFIED) */
  static async markModified(id: string, reason?: string, userId?: string) {
    const prisma = getPrisma();
    const archive = await prisma.physicalArchive.findUnique({
      where: { id },
      select: { id: true, workflowStatus: true, companyCode: true },
    });
    if (!archive) throw new NotFoundError('实体档案');

    if (userId) {
      await this.assertCompanyAccess(userId, archive.companyCode);
    }

    assertWorkflowTransition(archive.workflowStatus, 'MODIFIED');

    const result = await prisma.physicalArchive.update({
      where: { id },
      data: {
        workflowStatus: 'MODIFIED',
        reviewComment: reason || null,
      },
      include: physicalArchiveInclude,
    });
    return serializePhysicalArchive(result);
  }

  /** 动作：销毁档案 (-> DESTROYED) */
  static async destroy(id: string, destroyerName: string, destroyReason: string, userId?: string) {
    const prisma = getPrisma();
    const archive = await prisma.physicalArchive.findUnique({
      where: { id },
      select: { id: true, status: true, workflowStatus: true, companyCode: true },
    });
    if (!archive) throw new NotFoundError('实体档案');

    if (userId) {
      await this.assertCompanyAccess(userId, archive.companyCode);
    }

    assertWorkflowTransition(archive.workflowStatus, 'DESTROYED');
    assertInventoryTransition(archive.status, 'DESTROYED');

    const result = await prisma.physicalArchive.update({
      where: { id },
      data: {
        status: 'DESTROYED',
        workflowStatus: 'DESTROYED',
        destroyer: destroyerName,
        destroyedAt: new Date(),
        destroyReason,
      },
      include: physicalArchiveInclude,
    });
    return serializePhysicalArchive(result);
  }

  static async borrow(id: string, input: BorrowPhysicalArchiveInput, operatorId: string) {
    const prisma = getPrisma();
    const archive = await prisma.physicalArchive.findUnique({
      where: { id },
      include: physicalArchiveInclude,
    });

    if (!archive) {
      throw new NotFoundError('实体档案');
    }

    // 校验用户对该档案所属公司的数据权限
    await this.assertCompanyAccess(operatorId, archive.companyCode);

    if (archive.status !== 'IN_STOCK') {
      throw new ConflictError('实体档案当前不在库，无法借阅');
    }

    // 工作流需从 ARCHIVED 转 BORROWED
    assertWorkflowTransition(archive.workflowStatus, 'BORROWED');

    const borrowedAt = input.borrowedAt || new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.physicalArchive.update({
        where: { id },
        data: {
          status: 'BORROWED',
          workflowStatus: 'BORROWED',
          borrower: input.borrower,
          borrowedAt,
          borrowRemark: input.borrowRemark,
        },
        include: physicalArchiveInclude,
      });

      await tx.physicalArchiveBorrowRecord.create({
        data: {
          archiveId: id,
          action: 'BORROW',
          borrower: input.borrower,
          borrowedAt,
          dueAt: input.dueAt,
          remark: input.borrowRemark,
          operatorId,
        },
      });

      return updated;
    });

    return serializePhysicalArchive(result);
  }

  static async return(id: string, input: ReturnPhysicalArchiveInput, operatorId: string) {
    const prisma = getPrisma();
    const archive = await prisma.physicalArchive.findUnique({
      where: { id },
      include: physicalArchiveInclude,
    });

    if (!archive) {
      throw new NotFoundError('实体档案');
    }

    // 校验用户对该档案所属公司的数据权限
    await this.assertCompanyAccess(operatorId, archive.companyCode);

    if (archive.status !== 'BORROWED') {
      throw new ConflictError('实体档案当前非借阅状态，无法归还');
    }

    // 工作流从 BORROWED -> RETURNED
    assertWorkflowTransition(archive.workflowStatus, 'RETURNED');

    const returnedAt = input.returnedAt || new Date();

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.physicalArchive.update({
        where: { id },
        data: {
          status: 'IN_STOCK',
          workflowStatus: 'RETURNED',
          borrower: null,
          borrowedAt: null,
          borrowRemark: null,
        },
        include: physicalArchiveInclude,
      });

      await tx.physicalArchiveBorrowRecord.create({
        data: {
          archiveId: id,
          action: 'RETURN',
          borrower: archive.borrower,
          borrowedAt: archive.borrowedAt || undefined,
          returnedAt,
          remark: input.returnRemark,
          operatorId,
        },
      });

      return updated;
    });

    return serializePhysicalArchive(result);
  }

  static async listBorrowRecords(archiveId: string, options: { page?: number; pageSize?: number } = {}) {
    const prisma = getPrisma();
    const archive = await prisma.physicalArchive.findUnique({
      where: { id: archiveId },
      select: { id: true },
    });

    if (!archive) {
      throw new NotFoundError('实体档案');
    }

    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [records, total] = await Promise.all([
      prisma.physicalArchiveBorrowRecord.findMany({
        where: { archiveId },
        include: {
          operator: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.physicalArchiveBorrowRecord.count({
        where: { archiveId },
      }),
    ]);

    return {
      records,
      total,
      page,
      pageSize,
    };
  }
}
