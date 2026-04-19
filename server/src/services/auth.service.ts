import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { getPrisma } from '../config/database.js';
import { getRedis } from '../config/redis.js';
import { AuthenticationError, ValidationError, NotFoundError } from '../utils/errors.js';
import { createAuditLog } from '../middleware/audit.js';
import { normalizePermissionCodes } from '../utils/permissions.js';
import { SystemConfigService } from './system-config.service.js';
import { logger } from '../config/logger.js';
import type { User, Role, Permission } from '@prisma/client';

export interface LoginInput {
  username: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  name: string;
  phone?: string;
  departmentId?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  user: Omit<User, 'password'> & {
    roles: (Role & { permissions: Permission[] })[];
    permissions: string[];
  };
  tokens: TokenPair;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;
  private static readonly SESSION_PREFIX = 'session:';
  private static readonly REFRESH_PREFIX = 'refresh:';
  private static readonly LOGIN_ATTEMPTS_PREFIX = 'login_attempts:';
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCK_DURATION = 15 * 60; // 15 minutes
  private static readonly RESET_CODE_PREFIX = 'reset_code:';
  private static readonly RESET_CODE_EXPIRY = 10 * 60; // 10 minutes
  private static readonly SESSION_RETRY_LIMIT = 3;

  private static isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object'
      && error !== null
      && 'code' in error
      && (error as { code?: string }).code === 'P2002';
  }

  static async register(input: RegisterInput): Promise<Omit<User, 'password'>> {
    const prisma = getPrisma();
    const allowRegister = await SystemConfigService.canSelfRegister();

    if (!allowRegister) {
      throw new ValidationError('系统已关闭注册功能，请联系管理员');
    }

    const passwordMinLength = await SystemConfigService.getPasswordMinLength();
    if (input.password.length < passwordMinLength) {
      throw new ValidationError(`密码长度至少 ${passwordMinLength} 位`);
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: input.username },
          { email: input.email },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.username === input.username) {
        throw new ValidationError('用户名已存在');
      }
      throw new ValidationError('邮箱已被注册');
    }

    const hashedPassword = await bcrypt.hash(input.password, this.SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        password: hashedPassword,
        name: input.name,
        phone: input.phone,
        departmentId: input.departmentId,
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  static async login(input: LoginInput): Promise<AuthResult> {
    const prisma = getPrisma();
    const attemptsKey = `${this.LOGIN_ATTEMPTS_PREFIX}${input.username}`;

    try {
      const attempts = await getRedis().get(attemptsKey);
      if (attempts && parseInt(attempts) >= this.MAX_LOGIN_ATTEMPTS) {
        throw new AuthenticationError('账户已被锁定，请稍后再试');
      }
    } catch {
      // Redis may be unavailable; continue with DB auth.
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: input.username },
          { email: input.username },
        ],
      },
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
      await this.incrementLoginAttempts(attemptsKey);
      throw new AuthenticationError('用户名或密码错误');
    }

    if (user.status !== 'ACTIVE') {
      throw new AuthenticationError('用户已被禁用');
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.password);
    if (!isPasswordValid) {
      await this.incrementLoginAttempts(attemptsKey);
      throw new AuthenticationError('用户名或密码错误');
    }

    const sessionId = uuidv4();
    const tokens = await this.createSessionWithRetry(sessionId, user.id, input);

    try {
      await getRedis().del(attemptsKey);
    } catch {
      // Ignore redis cleanup failures.
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: input.ip,
      },
    });

    await createAuditLog(user.id, 'LOGIN', 'AUTH', {
      ip: input.ip,
      userAgent: input.userAgent,
      status: 'SUCCESS',
    });

    const roles = user.roles.map((ur) => ({
      ...ur.role,
      permissions: ur.role.permissions.map((rp) => rp.permission),
    }));

    const permissions = normalizePermissionCodes(
      [...new Set(roles.flatMap((role) => role.permissions.map((permission) => permission.code)))]
    );

    const { password: _, roles: __, ...userWithoutPassword } = user;

    return {
      user: {
        ...userWithoutPassword,
        roles,
        permissions,
      },
      tokens,
    };
  }

  static async logout(sessionId: string, userId: string): Promise<void> {
    const prisma = getPrisma();

    try {
      await getRedis().del(`${this.SESSION_PREFIX}${sessionId}`);
    } catch {
      // ignore
    }

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId },
    });

    if (session) {
      try {
        await getRedis().del(`${this.REFRESH_PREFIX}${session.refreshToken}`);
      } catch {
        // ignore
      }
      await prisma.session.delete({ where: { id: sessionId } });
    }

    await createAuditLog(userId, 'LOGOUT', 'AUTH', { status: 'SUCCESS' });
  }

  static async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const prisma = getPrisma();
    let userId: string | undefined;
    let sessionId: string | undefined;

    try {
      const sessionData = await getRedis().get(`${this.REFRESH_PREFIX}${refreshToken}`);
      if (sessionData) {
        const parsed = JSON.parse(sessionData) as { userId: string; sessionId: string };
        userId = parsed.userId;
        sessionId = parsed.sessionId;
      }
    } catch {
      // ignore redis read errors
    }

    if (!userId || !sessionId) {
      const session = await prisma.session.findFirst({
        where: {
          refreshToken,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          userId: true,
        },
      });

      if (!session) {
        throw new AuthenticationError('刷新令牌无效或已过期');
      }

      userId = session.userId;
      sessionId = session.id;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      throw new AuthenticationError('用户不存在或已被禁用');
    }

    try {
      await getRedis().del(`${this.REFRESH_PREFIX}${refreshToken}`);
    } catch {
      // ignore
    }

    const tokens = await this.generateTokens(userId, sessionId);

    try {
      await getRedis().setex(
        `${this.SESSION_PREFIX}${sessionId}`,
        this.parseExpiration(config.JWT_EXPIRES_IN),
        JSON.stringify({ userId, createdAt: new Date().toISOString() })
      );

      await getRedis().setex(
        `${this.REFRESH_PREFIX}${tokens.refreshToken}`,
        this.parseExpiration(config.JWT_REFRESH_EXPIRES_IN),
        JSON.stringify({ userId, sessionId })
      );
    } catch {
      // ignore
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        token: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAt: new Date(Date.now() + this.parseExpiration(config.JWT_EXPIRES_IN) * 1000),
      },
    });

    return tokens;
  }

  static async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('用户');
    }

    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      throw new ValidationError('原密码错误');
    }

    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.invalidateAllSessions(userId);

    await createAuditLog(userId, 'CHANGE_PASSWORD', 'AUTH', { status: 'SUCCESS' });
  }

  static async resetPassword(userId: string, newPassword: string): Promise<void> {
    const prisma = getPrisma();
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    await this.invalidateAllSessions(userId);

    await createAuditLog(userId, 'RESET_PASSWORD', 'AUTH', { status: 'SUCCESS' });
  }

  private static async generateTokens(userId: string, sessionId: string): Promise<TokenPair> {
    const accessToken = jwt.sign(
      // Add jti to guarantee unique access token values in high-concurrency logins.
      { userId, sessionId, jti: uuidv4() },
      config.JWT_SECRET,
      { expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] }
    );

    const refreshToken = uuidv4();
    const expiresIn = this.parseExpiration(config.JWT_EXPIRES_IN);

    return { accessToken, refreshToken, expiresIn };
  }

  private static async saveSession(
    sessionId: string,
    userId: string,
    accessToken: string,
    refreshToken: string,
    input: LoginInput
  ): Promise<void> {
    const prisma = getPrisma();

    await prisma.session.create({
      data: {
        id: sessionId,
        userId,
        token: accessToken,
        refreshToken,
        ip: input.ip,
        userAgent: input.userAgent,
        expiresAt: new Date(Date.now() + this.parseExpiration(config.JWT_EXPIRES_IN) * 1000),
      },
    });

    try {
      await getRedis().setex(
        `${this.SESSION_PREFIX}${sessionId}`,
        this.parseExpiration(config.JWT_EXPIRES_IN),
        JSON.stringify({ userId, createdAt: new Date().toISOString() })
      );

      await getRedis().setex(
        `${this.REFRESH_PREFIX}${refreshToken}`,
        this.parseExpiration(config.JWT_REFRESH_EXPIRES_IN),
        JSON.stringify({ userId, sessionId })
      );
    } catch {
      // keep DB session as source of truth if Redis is unavailable
    }
  }

  private static async createSessionWithRetry(
    sessionId: string,
    userId: string,
    input: LoginInput
  ): Promise<TokenPair> {
    let attempt = 0;

    while (attempt < this.SESSION_RETRY_LIMIT) {
      const tokens = await this.generateTokens(userId, sessionId);
      try {
        await this.saveSession(sessionId, userId, tokens.accessToken, tokens.refreshToken, input);
        return tokens;
      } catch (error) {
        if (!this.isUniqueConstraintError(error) || attempt >= this.SESSION_RETRY_LIMIT - 1) {
          throw error;
        }
        logger.warn('Session token collision detected, retrying token generation');
      }
      attempt += 1;
    }

    throw new AuthenticationError('登录失败，请重试');
  }

  private static async incrementLoginAttempts(key: string): Promise<void> {
    try {
      const redis = getRedis();
      await redis.incr(key);
      await redis.expire(key, this.LOCK_DURATION);
    } catch {
      // ignore redis failures for rate-limit counters
    }
  }

  private static async invalidateAllSessions(userId: string): Promise<void> {
    const prisma = getPrisma();

    const sessions = await prisma.session.findMany({ where: { userId } });

    for (const session of sessions) {
      try {
        await getRedis().del(`${this.SESSION_PREFIX}${session.id}`);
        await getRedis().del(`${this.REFRESH_PREFIX}${session.refreshToken}`);
      } catch {
        // ignore
      }
    }

    await prisma.session.deleteMany({ where: { userId } });
  }

  private static parseExpiration(expiration: string): number {
    const match = expiration.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600;
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 3600;
    }
  }

  /**
   * 生成重置密码验证码
   */
  static async generateResetCode(email: string): Promise<string> {
    const prisma = getPrisma();
    const redis = getRedis();

    // 查找用户
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // 为了安全，不暴露用户是否存在
      throw new ValidationError('如果该邮箱存在，验证码将发送到邮箱');
    }

    // 生成6位数字验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存储到Redis，10分钟过期
    const key = `${this.RESET_CODE_PREFIX}${email}`;
    await redis.setex(key, this.RESET_CODE_EXPIRY, code);

    logger.info(`重置密码验证码已生成: ${email} -> ${code}`);

    // TODO: 这里应该发送邮件，暂时返回验证码（生产环境应该删除）
    return code;
  }

  /**
   * 验证重置密码验证码
   */
  static async verifyResetCode(email: string, code: string): Promise<boolean> {
    const redis = getRedis();
    const key = `${this.RESET_CODE_PREFIX}${email}`;

    const storedCode = await redis.get(key);
    if (!storedCode || storedCode !== code) {
      return false;
    }

    return true;
  }

  /**
   * 通过验证码重置密码
   */
  static async resetPasswordWithCode(
    email: string,
    code: string,
    newPassword: string
  ): Promise<void> {
    const prisma = getPrisma();
    const redis = getRedis();

    // 验证验证码
    const isValid = await this.verifyResetCode(email, code);
    if (!isValid) {
      throw new ValidationError('验证码无效或已过期');
    }

    // 查找用户
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundError('用户');
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // 删除验证码
    const key = `${this.RESET_CODE_PREFIX}${email}`;
    await redis.del(key);

    // 使所有会话失效
    await this.invalidateAllSessions(user.id);

    logger.info(`用户密码已重置: ${email}`);
  }

  /**
   * 管理员重置用户密码
   */
  static async adminResetPassword(
    userId: string,
    newPassword: string,
    adminId: string
  ): Promise<void> {
    const prisma = getPrisma();

    // 查找用户
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError('用户');
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // 使所有会话失效
    await this.invalidateAllSessions(userId);

    // 记录审计日志
    await createAuditLog(adminId, 'RESET_PASSWORD', 'USER', {
      resourceType: 'USER',
      resourceId: userId,
      details: { targetUser: user.username },
      ip: '',
      userAgent: '',
    });

    logger.info(`管理员重置用户密码: ${user.username} by admin ${adminId}`);
  }
}
