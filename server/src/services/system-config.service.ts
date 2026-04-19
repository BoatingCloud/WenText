import { z } from 'zod';
import { getPrisma } from '../config/database.js';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';
import { cacheDelPattern } from '../config/redis.js';
import { DepartmentService } from './department.service.js';

export const themePresetSchema = z.enum([
  'cement-gray',
  'sea-salt-blue',
  'warm-sand',
  'jade-ink',
]);

export type ThemePreset = z.infer<typeof themePresetSchema>;

const fondsCatalogItemSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
});

export type FondsCatalogItem = z.infer<typeof fondsCatalogItemSchema>;

const companyCatalogItemSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
});

export type CompanyCatalogItem = z.infer<typeof companyCatalogItemSchema>;

const publicThemeConfigSchema = z.object({
  siteName: z.string().min(1).max(100),
  themePreset: themePresetSchema,
});

export type PublicThemeConfig = z.infer<typeof publicThemeConfigSchema>;

export const archiveBorrowModeSchema = z.enum(['direct', 'workflow']);
export type ArchiveBorrowMode = z.infer<typeof archiveBorrowModeSchema>;

// AI配置相关
export const aiProviderSchema = z.enum([
  'openai',
  'claude',
  'wenxin',
  'qwen',
  'spark',
  'zhipu',
  'custom',
]);

export type AIProvider = z.infer<typeof aiProviderSchema>;

const aiConfigSchema = z.object({
  enabled: z.boolean().default(false),
  provider: aiProviderSchema.default('openai'),
  apiKey: z.string().max(500).optional(),
  apiEndpoint: z.string().url().max(500).optional(),
  model: z.string().max(100).optional(),
  maxTokens: z.number().int().min(100).max(32000).default(4000),
  temperature: z.number().min(0).max(2).default(0.3),
});

export type AIConfig = z.infer<typeof aiConfigSchema>;

const siteSettingsSchema = z.object({
  siteName: z.string().min(1).max(100),
  siteDescription: z.string().max(200),
  groupName: z.string().min(1).max(100),
  themePreset: themePresetSchema,
  allowRegister: z.boolean(),
  passwordMinLength: z.number().int().min(6).max(32),
  uploadMaxSizeMB: z.number().int().min(10).max(2048),
  defaultRepositoryBasePath: z.string().min(1).max(255),
  defaultRepositoryMaxVersions: z.number().int().min(1).max(1000),
  companyCatalog: z.array(companyCatalogItemSchema).max(500),
  fondsCatalog: z.array(fondsCatalogItemSchema).max(200),
  archiveBorrowMode: archiveBorrowModeSchema,
  aiConfig: aiConfigSchema.optional(),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,
  provider: 'openai',
  apiKey: undefined,
  apiEndpoint: undefined,
  model: undefined,
  maxTokens: 4000,
  temperature: 0.3,
};

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteName: '文雨文档管理系统',
  siteDescription: '企业级文档与知识管理平台',
  groupName: '文雨集团',
  themePreset: 'sea-salt-blue',
  allowRegister: true,
  passwordMinLength: 6,
  uploadMaxSizeMB: 100,
  defaultRepositoryBasePath: config.STORAGE_BASE_PATH,
  defaultRepositoryMaxVersions: 100,
  companyCatalog: [],
  fondsCatalog: [
    { name: '深圳文雨', code: 'SZ' },
    { name: '文雨集团', code: 'WY' },
    { name: '总部综合档案', code: 'HQ' },
  ],
  archiveBorrowMode: 'direct',
  aiConfig: DEFAULT_AI_CONFIG,
};

export class SystemConfigService {
  private static readonly APPEARANCE_KEY = 'site.appearance';
  private static readonly SETTINGS_KEY = 'site.settings';

  private static toPublicThemeConfig(settings: SiteSettings): PublicThemeConfig {
    return {
      siteName: settings.siteName,
      themePreset: settings.themePreset,
    };
  }

  private static toPublicSiteConfig(settings: SiteSettings) {
    return {
      siteName: settings.siteName,
      siteDescription: settings.siteDescription,
      groupName: settings.groupName,
      themePreset: settings.themePreset,
      allowRegister: settings.allowRegister,
      companyCatalog: settings.companyCatalog,
      fondsCatalog: settings.fondsCatalog,
      archiveBorrowMode: settings.archiveBorrowMode,
    };
  }

  private static normalizeFondsCatalog(value: unknown): FondsCatalogItem[] {
    if (!Array.isArray(value)) {
      return DEFAULT_SITE_SETTINGS.fondsCatalog;
    }

    const parsed = value
      .map((item) => fondsCatalogItemSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data);

    if (parsed.length === 0) {
      return DEFAULT_SITE_SETTINGS.fondsCatalog;
    }

    const uniqMap = new Map<string, FondsCatalogItem>();
    parsed.forEach((item) => {
      const key = `${item.name}::${item.code}`;
      if (!uniqMap.has(key)) {
        uniqMap.set(key, item);
      }
    });

    return Array.from(uniqMap.values());
  }

  private static normalizeCompanyCatalog(value: unknown): CompanyCatalogItem[] {
    if (!Array.isArray(value)) {
      return DEFAULT_SITE_SETTINGS.companyCatalog;
    }

    const parsed = value
      .map((item) => companyCatalogItemSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data);

    if (parsed.length === 0) {
      return DEFAULT_SITE_SETTINGS.companyCatalog;
    }

    const uniqMap = new Map<string, CompanyCatalogItem>();
    parsed.forEach((item) => {
      if (!uniqMap.has(item.code)) {
        uniqMap.set(item.code, item);
      }
    });

    return Array.from(uniqMap.values());
  }

  private static normalizeSiteSettings(value: unknown): SiteSettings | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const raw = value as Record<string, unknown>;
    const merged = {
      ...DEFAULT_SITE_SETTINGS,
      ...raw,
      companyCatalog: this.normalizeCompanyCatalog(raw.companyCatalog),
      fondsCatalog: this.normalizeFondsCatalog(raw.fondsCatalog),
    };

    const parsed = siteSettingsSchema.safeParse(merged);
    if (!parsed.success) {
      return null;
    }

    return parsed.data;
  }

  static async ensureDefaults(): Promise<void> {
    try {
      const prisma = getPrisma();
      const appearance = await prisma.systemConfig.findUnique({
        where: { key: this.APPEARANCE_KEY },
      });

      const appearanceParsed = appearance
        ? publicThemeConfigSchema.safeParse(appearance.value)
        : null;

      const defaultsFromAppearance: SiteSettings = {
        ...DEFAULT_SITE_SETTINGS,
        ...(appearanceParsed?.success
          ? {
              siteName: appearanceParsed.data.siteName,
              themePreset: appearanceParsed.data.themePreset,
            }
          : {}),
      };

      const settingsRow = await prisma.systemConfig.upsert({
        where: { key: this.SETTINGS_KEY },
        update: {},
        create: {
          key: this.SETTINGS_KEY,
          value: defaultsFromAppearance,
          category: 'site',
          description: '站点完整设置',
        },
      });

      const normalizedSettings = this.normalizeSiteSettings(settingsRow.value);
      if (normalizedSettings && normalizedSettings.defaultRepositoryBasePath === '/tmp/wenyu/storage') {
        await prisma.systemConfig.update({
          where: { key: this.SETTINGS_KEY },
          data: {
            value: {
              ...normalizedSettings,
              defaultRepositoryBasePath: config.STORAGE_BASE_PATH,
            },
          },
        });
        await DepartmentService.syncOrganizationConfig(
          normalizedSettings.groupName,
          normalizedSettings.companyCatalog
        );
      } else if (normalizedSettings && JSON.stringify(normalizedSettings) !== JSON.stringify(settingsRow.value)) {
        await prisma.systemConfig.update({
          where: { key: this.SETTINGS_KEY },
          data: {
            value: normalizedSettings,
          },
        });
        await DepartmentService.syncOrganizationConfig(
          normalizedSettings.groupName,
          normalizedSettings.companyCatalog
        );
      } else if (normalizedSettings) {
        await DepartmentService.syncOrganizationConfig(
          normalizedSettings.groupName,
          normalizedSettings.companyCatalog
        );
      }

      await prisma.systemConfig.upsert({
        where: { key: this.APPEARANCE_KEY },
        update: {},
        create: {
          key: this.APPEARANCE_KEY,
          value: this.toPublicThemeConfig(defaultsFromAppearance),
          category: 'appearance',
          description: '站点外观配置',
        },
      });
    } catch (error) {
      logger.warn('ensureDefaults failed, fallback to in-memory defaults');
    }
  }

  static async getSiteSettings(): Promise<SiteSettings> {
    try {
      const prisma = getPrisma();
      const config = await prisma.systemConfig.findUnique({
        where: { key: this.SETTINGS_KEY },
      });

      if (config) {
        const normalized = this.normalizeSiteSettings(config.value);
        if (normalized) {
          return normalized;
        }
      }

      // Compatibility path for legacy installation with only site.appearance.
      const appearance = await prisma.systemConfig.findUnique({
        where: { key: this.APPEARANCE_KEY },
      });

      if (appearance) {
        const parsedAppearance = publicThemeConfigSchema.safeParse(appearance.value);
        if (parsedAppearance.success) {
          return {
            ...DEFAULT_SITE_SETTINGS,
            siteName: parsedAppearance.data.siteName,
            themePreset: parsedAppearance.data.themePreset,
          };
        }
      }
    } catch (error) {
      logger.warn('getSiteSettings failed, fallback to defaults');
    }

    return DEFAULT_SITE_SETTINGS;
  }

  static async getPublicSiteSettings() {
    const settings = await this.getSiteSettings();
    return this.toPublicSiteConfig(settings);
  }

  static async getPublicThemeConfig(): Promise<PublicThemeConfig> {
    const settings = await this.getSiteSettings();
    return this.toPublicThemeConfig(settings);
  }

  static async updateSiteSettings(input: Partial<SiteSettings>): Promise<SiteSettings> {
    const current = await this.getSiteSettings();

    const nextConfig = siteSettingsSchema.parse({
      ...current,
      ...input,
    });

    try {
      const prisma = getPrisma();

      await prisma.systemConfig.upsert({
        where: { key: this.SETTINGS_KEY },
        update: {
          value: nextConfig,
        },
        create: {
          key: this.SETTINGS_KEY,
          value: nextConfig,
          category: 'site',
          description: '站点完整设置',
        },
      });

      await prisma.systemConfig.upsert({
        where: { key: this.APPEARANCE_KEY },
        update: {
          value: this.toPublicThemeConfig(nextConfig),
        },
        create: {
          key: this.APPEARANCE_KEY,
          value: this.toPublicThemeConfig(nextConfig),
          category: 'appearance',
          description: '站点外观配置',
        },
      });

      await DepartmentService.syncOrganizationConfig(
        nextConfig.groupName,
        nextConfig.companyCatalog
      );

      // 公司目录变更后清除所有用户的权限范围缓存，确保数据权限及时刷新
      const catalogChanged =
        JSON.stringify(current.companyCatalog) !== JSON.stringify(nextConfig.companyCatalog);
      if (catalogChanged) {
        await cacheDelPattern('user:scope:*');
      }
    } catch (error) {
      logger.warn('updateSiteSettings failed to persist, returning computed config');
    }

    return nextConfig;
  }

  static async updateThemeConfig(input: Partial<PublicThemeConfig> & { themePreset: ThemePreset }): Promise<PublicThemeConfig> {
    const nextConfig = await this.updateSiteSettings({
      siteName: input.siteName,
      themePreset: input.themePreset,
    });

    return this.toPublicThemeConfig(nextConfig);
  }

  static async canSelfRegister(): Promise<boolean> {
    const settings = await this.getSiteSettings();
    return settings.allowRegister;
  }

  static async getPasswordMinLength(): Promise<number> {
    const settings = await this.getSiteSettings();
    return settings.passwordMinLength;
  }

  static async getUploadLimitBytes(): Promise<number> {
    const settings = await this.getSiteSettings();
    return settings.uploadMaxSizeMB * 1024 * 1024;
  }

  static async getRepositoryDefaults() {
    const settings = await this.getSiteSettings();
    return {
      basePath: settings.defaultRepositoryBasePath,
      maxVersions: settings.defaultRepositoryMaxVersions,
    };
  }

  // AI配置相关方法
  static async getAIConfig(): Promise<AIConfig> {
    const settings = await this.getSiteSettings();
    return settings.aiConfig || DEFAULT_AI_CONFIG;
  }

  static async updateAIConfig(input: Partial<AIConfig>): Promise<AIConfig> {
    const current = await this.getSiteSettings();
    const currentAI = current.aiConfig || DEFAULT_AI_CONFIG;

    const nextAIConfig = aiConfigSchema.parse({
      ...currentAI,
      ...input,
    });

    await this.updateSiteSettings({
      aiConfig: nextAIConfig,
    });

    return nextAIConfig;
  }

  // 获取脱敏后的AI配置（用于前端显示）
  static async getPublicAIConfig(): Promise<Omit<AIConfig, 'apiKey'> & { apiKey?: string }> {
    const config = await this.getAIConfig();
    return {
      ...config,
      apiKey: config.apiKey ? this.maskApiKey(config.apiKey) : undefined,
    };
  }

  // 脱敏API密钥
  private static maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '***';
    }
    const start = apiKey.substring(0, 4);
    const end = apiKey.substring(apiKey.length - 4);
    return `${start}***${end}`;
  }

  // 测试AI连接
  static async testAIConnection(config: Partial<AIConfig>): Promise<{
    success: boolean;
    message: string;
    latency?: number;
  }> {
    try {
      if (!config.apiKey) {
        return {
          success: false,
          message: 'API密钥不能为空',
        };
      }

      if (!config.provider) {
        return {
          success: false,
          message: 'AI服务提供商不能为空',
        };
      }

      // 动态导入AI适配器
      const { createAIAdapter } = await import('./ai/index.js');

      const adapter = createAIAdapter(config.provider);
      const fullConfig = {
        provider: config.provider,
        apiKey: config.apiKey,
        apiEndpoint: config.apiEndpoint,
        model: config.model,
        maxTokens: config.maxTokens || 4000,
        temperature: config.temperature || 0.3,
      };

      return await adapter.testConnection(fullConfig);
    } catch (error) {
      logger.error('AI connection test failed:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : '连接失败',
      };
    }
  }
}
