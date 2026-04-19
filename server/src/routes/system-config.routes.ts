import { Router } from 'express';
import { SystemConfigService } from '../services/system-config.service.js';
import { validate } from '../middleware/validate.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { asyncHandler, successResponse } from '../utils/response.js';
import { updateThemeConfigSchema, updateSiteSettingsSchema, updateAIConfigSchema, testAIConnectionSchema } from './schemas.js';

const router = Router();

router.get(
  '/public',
  asyncHandler(async (_req, res) => {
    const config = await SystemConfigService.getPublicSiteSettings();
    return successResponse(res, config);
  })
);

router.get(
  '/theme',
  authenticate,
  requirePermission('system:manage', 'system:config'),
  asyncHandler(async (_req, res) => {
    const config = await SystemConfigService.getPublicThemeConfig();
    return successResponse(res, config);
  })
);

router.put(
  '/theme',
  authenticate,
  requirePermission('system:manage', 'system:config'),
  validate(updateThemeConfigSchema),
  asyncHandler(async (req, res) => {
    const config = await SystemConfigService.updateThemeConfig(req.body);
    return successResponse(res, config, '主题设置保存成功');
  })
);

router.get(
  '/settings',
  authenticate,
  requirePermission('system:manage', 'system:config'),
  asyncHandler(async (_req, res) => {
    const settings = await SystemConfigService.getSiteSettings();
    return successResponse(res, settings);
  })
);

router.put(
  '/settings',
  authenticate,
  requirePermission('system:manage', 'system:config'),
  validate(updateSiteSettingsSchema),
  asyncHandler(async (req, res) => {
    const settings = await SystemConfigService.updateSiteSettings(req.body);
    return successResponse(res, settings, '系统设置保存成功');
  })
);

// AI配置相关路由
router.get(
  '/ai',
  authenticate,
  requirePermission('system:view', 'system:manage', 'system:config'),
  asyncHandler(async (_req, res) => {
    const config = await SystemConfigService.getPublicAIConfig();
    return successResponse(res, config);
  })
);

router.put(
  '/ai',
  authenticate,
  requirePermission('system:manage', 'system:config'),
  validate(updateAIConfigSchema),
  asyncHandler(async (req, res) => {
    let updateData = { ...req.body };
    // 如果 apiKey 是脱敏格式（包含 ***），保留数据库中原有的 apiKey
    if (updateData.apiKey && updateData.apiKey.includes('***')) {
      const savedConfig = await SystemConfigService.getAIConfig();
      updateData.apiKey = savedConfig.apiKey;
    }
    const config = await SystemConfigService.updateAIConfig(updateData);
    // 返回脱敏后的配置
    const publicConfig = {
      ...config,
      apiKey: config.apiKey ? `${config.apiKey.substring(0, 4)}***${config.apiKey.substring(config.apiKey.length - 4)}` : undefined,
    };
    return successResponse(res, publicConfig, 'AI配置保存成功');
  })
);

router.post(
  '/ai/test',
  authenticate,
  requirePermission('system:manage', 'system:config'),
  validate(testAIConnectionSchema),
  asyncHandler(async (req, res) => {
    let testConfig = { ...req.body };
    // 如果 apiKey 是脱敏格式（包含 ***），从数据库读取完整的 apiKey
    if (testConfig.apiKey && testConfig.apiKey.includes('***')) {
      const savedConfig = await SystemConfigService.getAIConfig();
      testConfig.apiKey = savedConfig.apiKey;
    }
    const result = await SystemConfigService.testAIConnection(testConfig);
    return successResponse(res, result);
  })
);

export default router;
