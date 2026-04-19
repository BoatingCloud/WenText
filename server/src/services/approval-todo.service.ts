import { getPrisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export class ApprovalTodoService {
  static async create(userId: string, type: string, referenceId: string, title: string) {
    const prisma = getPrisma();
    return prisma.approvalTodo.create({
      data: { userId, type, referenceId, title },
    });
  }

  static async getMyTodos(userId: string, options: { unreadOnly?: boolean; page?: number; pageSize?: number } = {}) {
    const prisma = getPrisma();
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where = {
      userId,
      ...(options.unreadOnly ? { isRead: false } : {}),
    };

    const [todos, total] = await Promise.all([
      prisma.approvalTodo.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.approvalTodo.count({ where }),
    ]);

    return { todos, total, page, pageSize };
  }

  static async getUnreadCount(userId: string): Promise<number> {
    const prisma = getPrisma();
    return prisma.approvalTodo.count({
      where: { userId, isRead: false },
    });
  }

  static async markRead(todoId: string, userId: string) {
    const prisma = getPrisma();
    const todo = await prisma.approvalTodo.findUnique({
      where: { id: todoId },
    });
    if (!todo) {
      throw new NotFoundError('待办通知');
    }
    if (todo.userId !== userId) {
      throw new NotFoundError('待办通知');
    }
    return prisma.approvalTodo.update({
      where: { id: todoId },
      data: { isRead: true },
    });
  }

  static async markAllRead(userId: string) {
    const prisma = getPrisma();
    await prisma.approvalTodo.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * 批量推送待办给多个用户
   */
  static async pushToUsers(userIds: string[], type: string, referenceId: string, title: string) {
    const prisma = getPrisma();

    // 批量创建待办
    const todos = await Promise.all(
      userIds.map((userId) =>
        prisma.approvalTodo.create({
          data: { userId, type, referenceId, title },
        })
      )
    );

    return todos;
  }

  /**
   * 根据资源ID完成待办
   */
  static async completeByResource(type: string, referenceId: string) {
    const prisma = getPrisma();
    await prisma.approvalTodo.deleteMany({
      where: { type, referenceId },
    });
  }
}
