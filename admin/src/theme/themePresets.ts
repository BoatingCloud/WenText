export type ThemePresetId = 'cement-gray' | 'sea-salt-blue' | 'warm-sand' | 'jade-ink';

interface ThemePresetDefinition {
  id: ThemePresetId;
  name: string;
  description: string;
  h: number;
  s: number;
  mainL: number;
  deltaL: number;
  actionL: number;
}

export interface ResolvedTheme {
  id: ThemePresetId;
  name: string;
  description: string;
  colors: {
    bgMain: string;
    bgLayer: string;
    bgPanel: string;
    line: string;
    textPrimary: string;
    textSecondary: string;
    action: string;
    actionSoft: string;
    warn: string;
    shadow: string;
  };
  preview: {
    bg: string;
    panel: string;
    action: string;
    text: string;
  };
  antdToken: {
    colorPrimary: string;
    colorBgLayout: string;
    colorBgContainer: string;
    colorBorder: string;
    colorText: string;
    colorTextSecondary: string;
    colorError: string;
    boxShadow: string;
    borderRadius: number;
  };
}

const THEME_PRESETS: ThemePresetDefinition[] = [
  {
    id: 'cement-gray',
    name: '水泥灰',
    description: '工业克制，秩序感更强',
    h: 210,
    s: 5,
    mainL: 97,
    deltaL: 14,
    actionL: 34,
  },
  {
    id: 'sea-salt-blue',
    name: '海盐蓝',
    description: '清冷轻松，默认推荐',
    h: 204,
    s: 11,
    mainL: 97,
    deltaL: 8,
    actionL: 35,
  },
  {
    id: 'warm-sand',
    name: '暖沙色',
    description: '温和柔软，低压舒适',
    h: 33,
    s: 10,
    mainL: 97,
    deltaL: 8,
    actionL: 36,
  },
  {
    id: 'jade-ink',
    name: '墨玉绿',
    description: '沉稳安静，文气克制',
    h: 154,
    s: 10,
    mainL: 96,
    deltaL: 8,
    actionL: 33,
  },
];

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const toHsl = (h: number, s: number, l: number): string => {
  return `hsl(${h} ${s}% ${l}%)`;
};

const toHsla = (h: number, s: number, l: number, a: number): string => {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
};

export const resolveThemePreset = (presetId: ThemePresetId): ResolvedTheme => {
  const preset = THEME_PRESETS.find((item) => item.id === presetId) || THEME_PRESETS[1];

  const bgMain = toHsl(preset.h, preset.s, preset.mainL);
  const bgLayer = toHsl(preset.h, preset.s, clamp(preset.mainL - preset.deltaL + 4, 82, 96));
  const bgPanel = toHsl(preset.h, preset.s, clamp(preset.mainL - Math.max(3, Math.round(preset.deltaL * 0.45)), 88, 96));
  const line = toHsl(preset.h, clamp(preset.s, 3, 10), clamp(preset.mainL - preset.deltaL + 2, 80, 94));
  const textPrimary = toHsl(preset.h, clamp(preset.s + 3, 4, 16), preset.actionL);
  const textSecondary = toHsl(preset.h, clamp(preset.s + 2, 4, 16), clamp(preset.actionL + 20, 50, 62));
  const action = toHsl(preset.h, clamp(preset.s + 8, 8, 25), clamp(preset.actionL + 6, 36, 46));
  const actionSoft = toHsl(preset.h, clamp(preset.s + 5, 7, 20), clamp(preset.mainL - 3, 90, 97));
  const warn = toHsl(0, 10, 45);
  const shadow = `0 10px 28px ${toHsla(preset.h, clamp(preset.s + 2, 4, 16), clamp(preset.actionL - 10, 15, 30), 0.1)}`;

  return {
    id: preset.id,
    name: preset.name,
    description: preset.description,
    colors: {
      bgMain,
      bgLayer,
      bgPanel,
      line,
      textPrimary,
      textSecondary,
      action,
      actionSoft,
      warn,
      shadow,
    },
    preview: {
      bg: bgMain,
      panel: bgPanel,
      action,
      text: textPrimary,
    },
    antdToken: {
      colorPrimary: action,
      colorBgLayout: bgMain,
      colorBgContainer: bgPanel,
      colorBorder: line,
      colorText: textPrimary,
      colorTextSecondary: textSecondary,
      colorError: warn,
      boxShadow: shadow,
      borderRadius: 10,
    },
  };
};

export const THEME_PRESET_OPTIONS = THEME_PRESETS.map((preset) => ({
  id: preset.id,
  name: preset.name,
  description: preset.description,
}));

export const DEFAULT_THEME_PRESET: ThemePresetId = 'sea-salt-blue';
