// =============================================================================
// COLORS - Two Birds Community Color Palette
// =============================================================================
// Aligned with Fluent Community CSS variables (--fcom-*)
// See: Fluent Reference Plugins/fluent-theme-integration-guide.md
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
  primaryLight: string;
  primaryDark: string;
  accent: string;

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
  icon: string;
  iconActive: string;

  // Semantic (same in both modes)
  success: string;
  successLight: string;
  error: string;
  errorLight: string;
  warning: string;
  warningLight: string;
  info: string;
  infoLight: string;

  // Reactions
  reactions: {
    like: string;
    love: string;
    laugh: string;
    wow: string;
    sad: string;
    angry: string;
  };

  // Tab Bar
  tabBar: {
    background: string;
    border: string;
    active: string;
    inactive: string;
  };

  // Special
  verified: string;
  online: string;
  skeleton: string;
  skeletonHighlight: string;
  overlay: string;
}

// -----------------------------------------------------------------------------
// Light Colors (Fluent default light schema values)
// -----------------------------------------------------------------------------

export const lightColors: ColorTheme = {
  // Brand
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',
  accent: '#F59E0B',

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
  icon: '#6B7280',
  iconActive: '#6366F1',

  // Semantic (non-themed)
  success: '#10B981',
  successLight: '#D1FAE5',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Reactions (aligned with REACTION_COLORS in constants/reactions.ts)
  reactions: {
    like: '#1877F2',
    love: '#F02849',
    laugh: '#FEEB30',
    wow: '#FEEB30',
    sad: '#FEEB30',
    angry: '#E41E3F',
  },

  // Tab Bar
  tabBar: {
    background: '#FFFFFF',
    border: '#E5E7EB',
    active: '#6366F1',
    inactive: '#9CA3AF',
  },

  // Special
  verified: '#3B82F6',
  online: '#10B981',
  skeleton: '#E5E7EB',
  skeletonHighlight: '#F3F4F6',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

// -----------------------------------------------------------------------------
// Dark Colors (Fluent default dark schema values)
// -----------------------------------------------------------------------------

export const darkColors: ColorTheme = {
  // Brand
  primary: '#818CF8',
  primaryLight: '#A5B4FC',
  primaryDark: '#6366F1',
  accent: '#FBBF24',

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
  icon: '#9CA3AF',
  iconActive: '#818CF8',

  // Semantic (non-themed — same in both modes)
  success: '#10B981',
  successLight: '#064E3B',
  error: '#EF4444',
  errorLight: '#7F1D1D',
  warning: '#F59E0B',
  warningLight: '#78350F',
  info: '#3B82F6',
  infoLight: '#1E3A5F',

  // Reactions (same in both modes)
  reactions: {
    like: '#3B82F6',
    love: '#EF4444',
    laugh: '#F59E0B',
    wow: '#F59E0B',
    sad: '#F59E0B',
    angry: '#EF4444',
  },

  // Tab Bar
  tabBar: {
    background: '#1F2937',
    border: '#374151',
    active: '#818CF8',
    inactive: '#6B7280',
  },

  // Special
  verified: '#60A5FA',
  online: '#10B981',
  skeleton: '#374151',
  skeletonHighlight: '#4B5563',
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
  if (fluentBody.menu_text) result.icon = fluentBody.menu_text;
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
  const hex = color.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
