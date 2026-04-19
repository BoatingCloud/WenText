import { getPrisma } from '../config/database.js';

export interface DocumentReviewScopeResult {
  companyCodes: string[];
  isAllCompanies: boolean;
}

export class DocumentReviewPermissionService {
  /**
   * 获取用户的文档审查公司范围
   */
  static async getCompanyScopes(userId: string): Promise<DocumentReviewScopeResult> {
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        documentReviewScopes: true,
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
      return { companyCodes: [], isAllCompanies: false };
    }

    // 检查是否有查看所有公司的权限
    const permissions = user.roles.flatMap((ur) =>
      ur.role.permissions.map((rp) => rp.permission.code)
    );

    // 系统管理员或有 doc-review:view-all 权限的用户可以查看所有公司
    const hasViewAll = permissions.includes('system:manage') || permissions.includes('doc-review:view-all');

    if (hasViewAll) {
      return { companyCodes: [], isAllCompanies: true };
    }

    // 返回用户配置的公司范围
    const companyCodes = user.documentReviewScopes.map((s) => s.companyCode);
    return { companyCodes, isAllCompanies: false };
  }

  /**
   * 为用户设置文档审查公司范围
   */
  static async setCompanyScopes(
    userId: string,
    companyCodes: string[]
  ): Promise<void> {
    const prisma = getPrisma();

    await prisma.$transaction(async (tx) => {
      // 删除现有的公司范围
      await tx.userDocumentReviewScope.deleteMany({
        where: { userId },
      });

      // 创建新的公司范围
      if (companyCodes.length > 0) {
        await tx.userDocumentReviewScope.createMany({
          data: companyCodes.map((companyCode) => ({
            userId,
            companyCode,
          })),
        });
      }
    });
  }
}
