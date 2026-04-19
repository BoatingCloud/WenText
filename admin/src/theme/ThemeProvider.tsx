import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { App as AntdApp, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { systemConfigApi, ThemeConfig } from '../services/api';
import {
  DEFAULT_THEME_PRESET,
  resolveThemePreset,
  THEME_PRESET_OPTIONS,
  ThemePresetId,
} from './themePresets';

interface SiteThemeContextValue {
  siteName: string;
  themePreset: ThemePresetId;
  isReady: boolean;
  themeOptions: typeof THEME_PRESET_OPTIONS;
  refreshThemeConfig: () => Promise<void>;
  updateThemeConfig: (input: Partial<ThemeConfig> & { themePreset: ThemePresetId }) => Promise<void>;
}

const ThemeContext = createContext<SiteThemeContextValue | null>(null);

const isThemePresetId = (value: unknown): value is ThemePresetId => {
  return typeof value === 'string' && THEME_PRESET_OPTIONS.some((item) => item.id === value);
};

const readStoredThemePreset = (): ThemePresetId => {
  const stored = localStorage.getItem('site-theme-preset');
  return isThemePresetId(stored) ? stored : DEFAULT_THEME_PRESET;
};

const applyThemeToCssVariables = (themePreset: ThemePresetId): void => {
  const theme = resolveThemePreset(themePreset);
  const root = document.documentElement;

  root.style.setProperty('--bg-main', theme.colors.bgMain);
  root.style.setProperty('--bg-layer', theme.colors.bgLayer);
  root.style.setProperty('--bg-panel', theme.colors.bgPanel);
  root.style.setProperty('--line-soft', theme.colors.line);
  root.style.setProperty('--text-primary', theme.colors.textPrimary);
  root.style.setProperty('--text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--action-color', theme.colors.action);
  root.style.setProperty('--action-soft', theme.colors.actionSoft);
  root.style.setProperty('--warn-color', theme.colors.warn);
  root.style.setProperty('--shadow-soft', theme.colors.shadow);
  root.setAttribute('data-theme', theme.id);

  document.body.style.backgroundColor = theme.colors.bgMain;
};

export const SiteThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [siteName, setSiteName] = useState('文雨文档管理系统');
  const [themePreset, setThemePreset] = useState<ThemePresetId>(readStoredThemePreset);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    localStorage.setItem('site-theme-preset', themePreset);
    applyThemeToCssVariables(themePreset);
  }, [themePreset]);

  useEffect(() => {
    const bootstrapTheme = async () => {
      try {
        const response = await systemConfigApi.getPublicTheme();
        const config = response.data.data;

        if (response.data.success && config && isThemePresetId(config.themePreset)) {
          setThemePreset(config.themePreset);
          setSiteName(config.siteName || '文雨文档管理系统');
        }
      } catch {
        // ignore and fallback to local theme
      } finally {
        setIsReady(true);
      }
    };

    bootstrapTheme();
  }, []);

  useEffect(() => {
    document.title = `${siteName} · 管理后台`;
  }, [siteName]);

  const refreshThemeConfig = useCallback(async () => {
    const response = await systemConfigApi.getPublicTheme();
    const config = response.data.data;

    if (response.data.success && config && isThemePresetId(config.themePreset)) {
      setThemePreset(config.themePreset);
      setSiteName(config.siteName || '文雨文档管理系统');
    }
  }, []);

  const updateThemeConfig = useCallback(async (input: Partial<ThemeConfig> & { themePreset: ThemePresetId }) => {
    const response = await systemConfigApi.updateTheme(input);
    const config = response.data.data;

    if (response.data.success && config && isThemePresetId(config.themePreset)) {
      setThemePreset(config.themePreset);
      setSiteName(config.siteName || '文雨文档管理系统');
    }
  }, []);

  const theme = useMemo(() => resolveThemePreset(themePreset), [themePreset]);

  const contextValue = useMemo(
    () => ({
      siteName,
      themePreset,
      isReady,
      themeOptions: THEME_PRESET_OPTIONS,
      refreshThemeConfig,
      updateThemeConfig,
    }),
    [siteName, themePreset, isReady, refreshThemeConfig, updateThemeConfig]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            ...theme.antdToken,
            colorBgElevated: theme.colors.bgPanel,
            colorFillSecondary: theme.colors.actionSoft,
            colorLink: theme.colors.action,
            colorLinkHover: theme.colors.textPrimary,
          },
          components: {
            Layout: {
              bodyBg: theme.colors.bgMain,
              siderBg: theme.colors.bgLayer,
              headerBg: theme.colors.bgPanel,
            },
            Menu: {
              itemBg: 'transparent',
              subMenuItemBg: 'transparent',
              itemColor: theme.colors.textSecondary,
              itemSelectedColor: theme.colors.action,
              itemSelectedBg: theme.colors.actionSoft,
              itemHoverColor: theme.colors.textPrimary,
            },
          },
        }}
      >
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useSiteTheme = (): SiteThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useSiteTheme must be used within SiteThemeProvider');
  }
  return context;
};
