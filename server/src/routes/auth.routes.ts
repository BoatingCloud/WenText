import { Router } from 'express';
import { AuthService } from '../services/auth.service.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, successResponse } from '../utils/response.js';
import {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  adminResetPasswordSchema,
} from './schemas.js';

const router = Router();

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await AuthService.login({
      ...req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return successResponse(res, result, '登录成功');
  })
);

router.post(
  '/register',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const user = await AuthService.register(req.body);
    return successResponse(res, user, '注册成功', 201);
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    await AuthService.logout(req.sessionId!, req.user!.id);
    return successResponse(res, null, '退出成功');
  })
);

router.post(
  '/refresh',
  validate(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    const tokens = await AuthService.refreshTokens(req.body.refreshToken);
    return successResponse(res, tokens, '令牌刷新成功');
  })
);

router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (req, res) => {
    await AuthService.changePassword(
      req.user!.id,
      req.body.oldPassword,
      req.body.newPassword
    );
    return successResponse(res, null, '密码修改成功');
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    return successResponse(res, req.user);
  })
);

/**
 * 忘记密码 - 生成验证码
 */
router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const code = await AuthService.generateResetCode(req.body.email);
    // TODO: 生产环境应该通过邮件发送验证码，不应该返回
    return successResponse(res, { code }, '验证码已生成，请查收邮件');
  })
);

/**
 * 重置密码 - 通过验证码
 */
router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    await AuthService.resetPasswordWithCode(
      req.body.email,
      req.body.code,
      req.body.newPassword
    );
    return successResponse(res, null, '密码重置成功');
  })
);

/**
 * 管理员重置用户密码
 */
router.post(
  '/admin-reset-password',
  authenticate,
  requirePermission('user:manage'),
  validate(adminResetPasswordSchema),
  asyncHandler(async (req, res) => {
    await AuthService.adminResetPassword(
      req.body.userId,
      req.body.newPassword,
      req.user!.id
    );
    return successResponse(res, null, '密码重置成功');
  })
);

export default router;
