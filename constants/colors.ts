// =============================================================================
// COLORS - App Color Palette
// =============================================================================
// Token names map to Fluent Community CSS variables (--fcom-*)
// Defaults are overridden at runtime by ThemeContext via /app-config API
// Full reference: docs/theme-system.html
//
// Usage:
//   import { useTheme } from '@/contexts/ThemeContext';
//   const { colors } = useTheme();
//   <View style={{ backgroundColor: colors.background }} />
// =============================================================================

// -----------------------------------------------------------------------------
// Color Theme Type
// -----------------------------------------------------------------------------

export interface ColorTheme {
  // Brand
  primary: string;
  primaryDark: string;

  // Backgrounds
  background: string;
  surface: string;
  backgroundSecondary: string;
  activeBg: string;
  lightBg: string;
  deepBg: string;
  highlightBg: string;

  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // UI Elements
  border: string;
  borderLight: string;

  // Semantic (same in both modes)
  success: string;
  successLight: string;
  error: string;
  errorLight: string;
  warning: string;
  warningLight: string;
  info: string;
  infoLight: string;

  // Tab Bar
  tabBar: {
    background: string;
    border: string;
    active: string;
    inactive: string;
  };

  // Special
  overlay: string;
}

// -----------------------------------------------------------------------------
// Light Colors (app defaults — overridden by Fluent API at runtime)
// -----------------------------------------------------------------------------

export const lightColors: ColorTheme = {
  // Brand
  primary: '#6366F1',
  primaryDark: '#4F46E5',

  // Backgrounds
  background: '#F9FAFB',
  surface: '#FFFFFF',
  backgroundSecondary: '#F3F4F6',
  activeBg: '#f0f3f5',
  lightBg: '#E1E4EA',
  deepBg: '#222530',
  highlightBg: '#fffce3',

  // Text
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // UI Elements
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Semantic (non-themed)
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Tab Bar
  tabBar: {
    background: '#FFFFFF',
    border: '#E5E7EB',
    active: '#6366F1',
    inactive: '#9CA3AF',
  },

  // Special
  overlay: 'rgba(0, 0, 0, 0.5)',
};

// -----------------------------------------------------------------------------
// Dark Colors (app defaults — overridden by Fluent API at runtime)
// -----------------------------------------------------------------------------

export const darkColors: ColorTheme = {
  // Brand
  primary: '#818CF8',
  primaryDark: '#6366F1',

  // Backgrounds
  background: '#111827',
  surface: '#1F2937',
  backgroundSecondary: '#374151',
  activeBg: '#42464D',
  lightBg: '#2B303B',
  deepBg: '#E1E4EA',
  highlightBg: '#2c2c1a',

  // Text
  text: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  textInverse: '#111827',

  // UI Elements
  border: '#374151',
  borderLight: '#1F2937',

  // Semantic (non-themed — same in both modes)
  success: '#10B981',
  successLight: '#064E3B',
  error: '#EF4444',
  errorLight: '#7F1D1D',
  warning: '#F59E0B',
  warningLight: '#78350F',
  info: '#3B82F6',
  infoLight: '#1E3A5F',

  // Tab Bar
  tabBar: {
    background: '#1F2937',
    border: '#374151',
    active: '#818CF8',
    inactive: '#6B7280',
  },

  // Special
  overlay: 'rgba(0, 0, 0, 0.7)',
};

// -----------------------------------------------------------------------------
// Helper: Map Fluent API response to app color overrides
// -----------------------------------------------------------------------------

export function mapFluentToAppColors(
  fluentBody: Record<string, string | undefined>,
  fluentHeader?: Record<string, string | undefined>,
): Partial<ColorTheme> {
  const result: Partial<ColorTheme> = {};

  if (fluentBody.primary_bg) result.surface = fluentBody.primary_bg;
  if (fluentBody.secondary_bg) result.background = fluentBody.secondary_bg;
  if (fluentBody.secondary_content_bg) result.backgroundSecondary = fluentBody.secondary_content_bg;
  if (fluentBody.primary_text) result.text = fluentBody.primary_text;
  if (fluentBody.secondary_text) result.textSecondary = fluentBody.secondary_text;
  if (fluentBody.text_off) result.textTertiary = fluentBody.text_off;
  if (fluentBody.primary_border) result.border = fluentBody.primary_border;
  if (fluentBody.secondary_border) result.borderLight = fluentBody.secondary_border;
  if (fluentBody.text_link) result.primary = fluentBody.text_link;
  if (fluentBody.primary_button) result.primaryDark = fluentBody.primary_button;
  if (fluentBody.primary_button_text) result.textInverse = fluentBody.primary_button_text;
  if (fluentBody.active_bg) result.activeBg = fluentBody.active_bg;
  if (fluentBody.light_bg) result.lightBg = fluentBody.light_bg;
  if (fluentBody.deep_bg) result.deepBg = fluentBody.deep_bg;
  if (fluentBody.highlight_bg) result.highlightBg = fluentBody.highlight_bg;

  if (fluentHeader) {
    result.tabBar = {
      background: fluentHeader.primary_bg || '',
      border: fluentHeader.primary_border || '',
      active: fluentHeader.menu_text_active || '',
      inactive: fluentHeader.menu_text || '',
    };
  }

  return result;
}

// -----------------------------------------------------------------------------
// Helper: Get color with opacity
// -----------------------------------------------------------------------------

export const withOpacity = (color: string, opacity: number): string => {
  // Pass through rgba/rgb values (just replace the alpha)
  if (color.startsWith('rgb')) return color.replace(/[\d.]+\)$/, `${opacity})`);
  let hex = color.replace('#', '');
  // Expand 3-char hex (#fff → ffffff)
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
