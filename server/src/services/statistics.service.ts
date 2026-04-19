import { getPrisma } from '../config/database.js';
import type { PhysicalArchiveStatus } from '@prisma/client';

export interface StatisticsFilters {
  companyCode?: string;
  startDate?: Date;
  endDate?: Date;
  categoryId?: string;
  fondsName?: string;
  status?: PhysicalArchiveStatus;
}

export interface ArchiveStatistics {
  totalCount: number;
  byStatus: Record<PhysicalArchiveStatus, number>;
  byCompany: Array<{ companyCode: string; count: number }>;
  byCategory: Array<{ categoryId: string; categoryName: string; count: number }>;
  byFonds: Array<{ fondsName: string; count: number }>;
  byYear: Array<{ year: number; count: number }>;
  byMonth: Array<{ month: string; count: number }>;
}

export interface DocumentStatistics {
  totalCount: number;
  totalSize: number;
  byRepository: Array<{ repositoryId: string; repositoryName: string; count: number; size: number }>;
  byType: Array<{ extension: string; count: number; size: number }>;
  byCreator: Array<{ creatorId: string; creatorName: string; count: number }>;
}

export interface BorrowStatistics {
  totalBorrowCount: number;
  totalReturnCount: number;
  currentBorrowedCount: number;
  byUser: Array<{ userId: string; userName: string; borrowCount: number; returnCount: number }>;
  byArchive: Array<{ archiveId: string; archiveTitle: string; borrowCount: number }>;
}

class StatisticsService {
  /**
   * 获取档案统计数据
   */
  async getArchiveStatistics(filters: StatisticsFilters): Promise<ArchiveStatistics> {
    const prisma = getPrisma();
    const where: any = {};

    if (filters.companyCode) {
      where.companyCode = filters.companyCode;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    if (filters.categoryId) {
      where.categoryId = filters.categoryId;
    }

    if (filters.fondsName) {
      where.fondsName = filters.fondsName;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    // 总数统计
    const totalCount = await prisma.physicalArchive.count({ where });

    // 按状态统计
    const statusGroups = await prisma.physicalArchive.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const byStatus: Record<PhysicalArchiveStatus, number> = {
      IN_STOCK: 0,
      BORROWED: 0,
      LOST: 0,
      DESTROYED: 0,
    };

    statusGroups.forEach((group) => {
      byStatus[group.status] = group._count;
    });

    // 按公司统计
    const companyGroups = await prisma.physicalArchive.groupBy({
      by: ['companyCode'],
      where,
      _count: true,
    });

    const byCompany = companyGroups
      .filter((g) => g.companyCode)
      .map((g) => ({
        companyCode: g.companyCode!,
        count: g._count,
      }));

    // 按分类统计
    const categoryGroups = await prisma.physicalArchive.groupBy({
      by: ['categoryId'],
      where,
      _count: true,
    });

    const categoryIds = categoryGroups.map((g) => g.categoryId).filter(Boolean) as string[];
    const categories = await prisma.archiveCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    });

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const byCategory = categoryGroups
      .filter((g) => g.categoryId)
      .map((g) => ({
        categoryId: g.categoryId!,
        categoryName: categoryMap.get(g.categoryId!) || '未知分类',
        count: g._count,
      }));

    // 按全宗统计
    const fondsGroups = await prisma.physicalArchive.groupBy({
      by: ['fondsName'],
      where,
      _count: true,
    });

    const byFonds = fondsGroups
      .filter((g) => g.fondsName)
      .map((g) => ({
        fondsName: g.fondsName!,
        count: g._count,
      }));

    // 按年份统计
    const yearGroups = await prisma.physicalArchive.groupBy({
      by: ['year'],
      where,
      _count: true,
    });

    const byYear = yearGroups
      .filter((g) => g.year)
      .map((g) => ({
        year: g.year!,
        count: g._count,
      }))
      .sort((a, b) => a.year - b.year);

    // 按月份统计（基于创建时间）
    const archives = await prisma.physicalArchive.findMany({
      where,
      select: { createdAt: true },
    });

    const monthMap = new Map<string, number>();
    archives.forEach((archive) => {
      const month = archive.createdAt.toISOString().slice(0, 7); // YYYY-MM
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
    });

    const byMonth = Array.from(monthMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      totalCount,
      byStatus,
      byCompany,
      byCategory,
      byFonds,
      byYear,
      byMonth,
    };
  }

  /**
   * 获取文档统计数据
   */
  async getDocumentStatistics(filters: { companyCode?: string; startDate?: Date; endDate?: Date }): Promise<DocumentStatistics> {
    const prisma = getPrisma();
    const where: any = {
      type: 'FILE',
      status: 'NORMAL',
    };

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    // 如果有公司过滤，需要通过仓库关联
    if (filters.companyCode) {
      where.repository = {
        companyCode: filters.companyCode,
      };
    }

    // 总数和总大小
    const aggregation = await prisma.document.aggregate({
      where,
      _count: true,
      _sum: { size: true },
    });

    const totalCount = aggregation._count || 0;
    const totalSize = Number(aggregation._sum.size || 0);

    // 按仓库统计
    const repoGroups = await prisma.document.groupBy({
      by: ['repositoryId'],
      where,
      _count: true,
      _sum: { size: true },
    });

    const repoIds = repoGroups.map((g) => g.repositoryId);
    const repositories = await prisma.repository.findMany({
      where: { id: { in: repoIds } },
      select: { id: true, name: true },
    });

    const repoMap = new Map(repositories.map((r) => [r.id, r.name]));

    const byRepository = repoGroups.map((g) => ({
      repositoryId: g.repositoryId,
      repositoryName: repoMap.get(g.repositoryId) || '未知仓库',
      count: g._count,
      size: Number(g._sum.size || 0),
    }));

    // 按文件类型统计
    const typeGroups = await prisma.document.groupBy({
      by: ['extension'],
      where,
      _count: true,
      _sum: { size: true },
    });

    const byType = typeGroups
      .filter((g) => g.extension)
      .map((g) => ({
        extension: g.extension!,
        count: g._count,
        size: Number(g._sum.size || 0),
      }));

    // 按创建者统计
    const creatorGroups = await prisma.document.groupBy({
      by: ['creatorId'],
      where,
      _count: true,
    });

    const creatorIds = creatorGroups.map((g) => g.creatorId);
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true },
    });

    const creatorMap = new Map(creators.map((c) => [c.id, c.name]));

    const byCreator = creatorGroups.map((g) => ({
      creatorId: g.creatorId,
      creatorName: creatorMap.get(g.creatorId) || '未知用户',
      count: g._count,
    }));

    return {
      totalCount,
      totalSize,
      byRepository,
      byType,
      byCreator,
    };
  }

  /**
   * 获取借阅统计数据
   */
  async getBorrowStatistics(filters: { companyCode?: string; startDate?: Date; endDate?: Date }): Promise<BorrowStatistics> {
    const prisma = getPrisma();
    const where: any = {};

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    // 如果有公司过滤，需要通过档案关联
    if (filters.companyCode) {
      where.archive = {
        companyCode: filters.companyCode,
      };
    }

    // 总借阅和归还次数
    const borrowCount = await prisma.physicalArchiveBorrowRecord.count({
      where: { ...where, action: 'BORROW' },
    });

    const returnCount = await prisma.physicalArchiveBorrowRecord.count({
      where: { ...where, action: 'RETURN' },
    });

    // 当前借出数量
    const currentBorrowedCount = await prisma.physicalArchive.count({
      where: {
        status: 'BORROWED',
        ...(filters.companyCode ? { companyCode: filters.companyCode } : {}),
      },
    });

    // 按用户统计
    const userBorrows = await prisma.physicalArchiveBorrowRecord.groupBy({
      by: ['operatorId', 'action'],
      where: { ...where, operatorId: { not: null } },
      _count: true,
    });

    const userMap = new Map<string, { borrowCount: number; returnCount: number }>();
    userBorrows.forEach((record) => {
      if (!record.operatorId) return;
      if (!userMap.has(record.operatorId)) {
        userMap.set(record.operatorId, { borrowCount: 0, returnCount: 0 });
      }
      const stats = userMap.get(record.operatorId)!;
      if (record.action === 'BORROW') {
        stats.borrowCount += record._count;
      } else {
        stats.returnCount += record._count;
      }
    });

    const userIds = Array.from(userMap.keys());
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    const userNameMap = new Map(users.map((u) => [u.id, u.name]));

    const byUser = Array.from(userMap.entries()).map(([userId, stats]) => ({
      userId,
      userName: userNameMap.get(userId) || '未知用户',
      borrowCount: stats.borrowCount,
      returnCount: stats.returnCount,
    }));

    // 按档案统计
    const archiveBorrows = await prisma.physicalArchiveBorrowRecord.groupBy({
      by: ['archiveId'],
      where: { ...where, action: 'BORROW' },
      _count: true,
    });

    const archiveIds = archiveBorrows.map((g) => g.archiveId);
    const archives = await prisma.physicalArchive.findMany({
      where: { id: { in: archiveIds } },
      select: { id: true, title: true },
    });

    const archiveMap = new Map(archives.map((a) => [a.id, a.title]));

    const byArchive = archiveBorrows.map((g) => ({
      archiveId: g.archiveId,
      archiveTitle: archiveMap.get(g.archiveId) || '未知档案',
      borrowCount: g._count,
    }));

    return {
      totalBorrowCount: borrowCount,
      totalReturnCount: returnCount,
      currentBorrowedCount,
      byUser,
      byArchive,
    };
  }
}

export default new StatisticsService();
