import { PrismaClient, AnnotationType, AnnotationStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateAnnotationDto {
  reviewId: string;
  attachmentId?: string;
  annotationType: AnnotationType;
  category?: string;
  severity?: string;
  title: string;
  description: string;
  location?: string;
  suggestion?: string;
  priority?: number;
}

export interface UpdateAnnotationDto {
  annotationType?: AnnotationType;
  category?: string;
  severity?: string;
  title?: string;
  description?: string;
  location?: string;
  suggestion?: string;
  priority?: number;
  status?: AnnotationStatus;
}

export interface ResolveAnnotationDto {
  resolveNote?: string;
}

export interface CreateCommentDto {
  content: string;
}

export const annotationService = {
  // 创建标注
  async create(annotatorId: string, data: CreateAnnotationDto) {
    return prisma.manualReviewAnnotation.create({
      data: {
        ...data,
        annotatorId,
        priority: data.priority ?? 0,
      },
      include: {
        annotator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  },

  // 获取标注列表
  async list(reviewId: string, filters?: {
    annotationType?: AnnotationType;
    status?: AnnotationStatus;
    priority?: number;
  }) {
    const where: any = { reviewId };

    if (filters?.annotationType) {
      where.annotationType = filters.annotationType;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.priority !== undefined) {
      where.priority = filters.priority;
    }

    return prisma.manualReviewAnnotation.findMany({
      where,
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
          orderBy: {
            createdAt: 'asc',
          },
        },
        _count: {
          select: {
            comments: true,
          },
        },
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  },

  // 获取单个标注
  async getById(id: string) {
    return prisma.manualReviewAnnotation.findUnique({
      where: { id },
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
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  },

  // 更新标注
  async update(id: string, data: UpdateAnnotationDto) {
    return prisma.manualReviewAnnotation.update({
      where: { id },
      data,
      include: {
        annotator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  },

  // 删除标注
  async delete(id: string) {
    return prisma.manualReviewAnnotation.delete({
      where: { id },
    });
  },

  // 解决标注
  async resolve(id: string, userId: string, data: ResolveAnnotationDto) {
    return prisma.manualReviewAnnotation.update({
      where: { id },
      data: {
        status: AnnotationStatus.RESOLVED,
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolveNote: data.resolveNote,
      },
      include: {
        annotator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  },

  // 忽略标注
  async ignore(id: string) {
    return prisma.manualReviewAnnotation.update({
      where: { id },
      data: {
        status: AnnotationStatus.IGNORED,
      },
      include: {
        annotator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  },

  // 重新激活标注
  async reactivate(id: string) {
    return prisma.manualReviewAnnotation.update({
      where: { id },
      data: {
        status: AnnotationStatus.ACTIVE,
        resolvedBy: null,
        resolvedAt: null,
        resolveNote: null,
      },
      include: {
        annotator: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  },

  // 添加评论
  async addComment(annotationId: string, userId: string, data: CreateCommentDto) {
    return prisma.annotationComment.create({
      data: {
        annotationId,
        userId,
        content: data.content,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
  },

  // 删除评论
  async deleteComment(commentId: string) {
    return prisma.annotationComment.delete({
      where: { id: commentId },
    });
  },

  // 获取统计信息
  async getStats(reviewId: string) {
    const annotations = await prisma.manualReviewAnnotation.findMany({
      where: { reviewId },
      select: {
        annotationType: true,
        status: true,
        priority: true,
      },
    });

    const stats = {
      total: annotations.length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
    };

    annotations.forEach((ann) => {
      // 按类型统计
      stats.byType[ann.annotationType] = (stats.byType[ann.annotationType] || 0) + 1;

      // 按状态统计
      stats.byStatus[ann.status] = (stats.byStatus[ann.status] || 0) + 1;

      // 按优先级统计
      const priorityKey = ann.priority.toString();
      stats.byPriority[priorityKey] = (stats.byPriority[priorityKey] || 0) + 1;
    });

    return stats;
  },
};
