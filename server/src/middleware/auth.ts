import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { getPrisma } from '../config/database.js';
import { getRedis } from '../config/redis.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import { normalizePermissionCodes } from '../utils/permissions.js';
import { User, Role, Permission } from '@prisma/client';

export interface JwtPayload {
  userId: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedUser extends Omit<User, 'password'> {
  roles: (Role & { permissions: Permission[] })[];
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      sessionId?: string;
    }
  }
}

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('未提供认证令牌');
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

    const prisma = getPrisma();
    let sessionValid = false;

    try {
      const sessionKey = `session:${decoded.sessionId}`;
      const sessionData = await getRedis().get(sessionKey);
      sessionValid = !!sessionData;
    } catch {
      sessionValid = false;
    }

    if (!sessionValid) {
      const session = await prisma.session.findFirst({
        where: {
          id: decoded.sessionId,
          userId: decoded.userId,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      });

      if (!session) {
        throw new AuthenticationError('会话已过期，请重新登录');
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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
        department: {
          include: {
            parent: {
              include: {
                parent: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AuthenticationError('用户不存在');
    }

    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('用户已被禁用');
    }

    const roles = user.roles.map((ur) => ({
      ...ur.role,
      permissions: ur.role.permissions.map((rp) => rp.permission),
    }));

    const permissions = normalizePermissionCodes(
      [...new Set(roles.flatMap((r) => r.permissions.map((p) => p.code)))]
    );

    const { password: _, roles: __, ...userWithoutPassword } = user;

    req.user = {
      ...userWithoutPassword,
      roles,
      permissions,
    } as AuthenticatedUser;
    req.sessionId = decoded.sessionId;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new AuthenticationError('令牌已过期'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new AuthenticationError('无效的令牌'));
    } else {
      next(error);
    }
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  return authenticate(req, res, next);
};

export const requirePermission = (...requiredPermissions: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('未认证'));
    }

    const hasPermission = requiredPermissions.some((permission) =>
      req.user!.permissions.includes(permission)
    );

    if (!hasPermission) {
      return next(new AuthorizationError('权限不足'));
    }

    next();
  };
};

export const requireRole = (...requiredRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new AuthenticationError('未认证'));
    }

    const hasRole = req.user.roles.some((role) =>
      requiredRoles.includes(role.code)
    );

    if (!hasRole) {
      return next(new AuthorizationError('角色权限不足'));
    }

    next();
  };
};
