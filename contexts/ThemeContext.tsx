// =============================================================================
// THEME CONTEXT - Global theme state with Fluent color sync
// =============================================================================

import {
  ColorTheme,
  darkColors,
  lightColors,
  mapFluentToAppColors,
} from '@/constants/colors';
import { getAppConfig, AppConfigResponse, MaintenanceConfig, UpdateConfig, ThemeData, BrandingConfig } from '@/services/api/appConfig';
import { setSocialProviders } from '@/services/api/socialProviders';
import { storage, getJSON, setJSON } from '@/services/storage';
import { createLogger } from '@/utils/logger';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const log = createLogger('ThemeContext');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: ColorTheme;
  setTheme: (mode: ThemeMode) => void;
  update: UpdateConfig | null;
  maintenance: MaintenanceConfig | null;
  branding: BrandingConfig | null;
  refreshAppConfig: () => Promise<void>;
  /** Accept pre-fetched data (from startup batch or _layout orchestrator) */
  setFromBatch: (data: AppConfigResponse) => void;
}

// -----------------------------------------------------------------------------
// Storage Keys
// -----------------------------------------------------------------------------

const THEME_PREF_KEY = 'theme_preference';
const CONFIG_CACHE_KEY = 'tbc_app_config_cache';

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // MMKV reads are synchronous — parse config once, use for all initializers
  const cachedConfig = getJSON<AppConfigResponse>(CONFIG_CACHE_KEY);

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = storage.getString(THEME_PREF_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'light';
  });
  const [fluentOverrides, setFluentOverrides] = useState<{
    light: Partial<ColorTheme>;
    dark: Partial<ColorTheme>;
  } | null>(() => {
    if (cachedConfig?.theme) {
      const lightOv = cachedConfig.theme.light ? mapFluentToAppColors(cachedConfig.theme.light.body, cachedConfig.theme.light.header) : {};
      const darkOv = cachedConfig.theme.dark ? mapFluentToAppColors(cachedConfig.theme.dark.body, cachedConfig.theme.dark.header) : {};
      return { light: lightOv, dark: darkOv };
    }
    return null;
  });
  const [update, setUpdate] = useState<UpdateConfig | null>(cachedConfig?.update ?? null);
  const [maintenance, setMaintenance] = useState<MaintenanceConfig | null>(cachedConfig?.maintenance ?? null);
  const [branding, setBranding] = useState<BrandingConfig | null>(cachedConfig?.branding ?? null);

  // Resolve isDark from preference
  const isDark = useMemo(() => theme === 'dark', [theme]);

  // Build active color palette
  const colors = useMemo(() => {
    const base = isDark ? { ...darkColors } : { ...lightColors };
    const overrides = isDark ? fluentOverrides?.dark : fluentOverrides?.light;

    if (overrides) {
      return {
        ...base,
        ...overrides,
        // Preserve nested objects — merge tabBar separately
        tabBar: overrides.tabBar?.background
          ? { ...base.tabBar, ...overrides.tabBar }
          : base.tabBar,
      };
    }

    return base;
  }, [isDark, fluentOverrides]);

  // ---------------------------------------------------------------------------
  // Background refresh on mount (cache already loaded synchronously above)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    refreshAppConfig();
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch fresh config from API (background)
  // ---------------------------------------------------------------------------

  const refreshAppConfig = useCallback(async () => {
    const data = await getAppConfig();
    if (!data) return;

    // Cache for next launch (synchronous)
    setJSON(CONFIG_CACHE_KEY, data);

    applyAppConfig(data);
  }, []);

  const setFromBatch = useCallback((data: AppConfigResponse) => {
    applyAppConfig(data);
    // Also cache so next cold start has latest data
    setJSON(CONFIG_CACHE_KEY, data);
  }, []);

  const applyAppConfig = (data: AppConfigResponse) => {
    // Apply theme colors
    if (data.theme) {
      applyThemeColors(data.theme);
    }
    // Apply social providers
    if (data.social_providers?.length) {
      setSocialProviders(data.social_providers);
    }
    // Apply update config
    setUpdate(data.update ?? null);
    // Apply maintenance status
    if (data.maintenance) {
      setMaintenance(data.maintenance);
    }
    // Apply branding
    setBranding(data.branding ?? null);
  };

  const applyThemeColors = (theme: ThemeData) => {
    if (!theme.light && !theme.dark) return;

    const lightOverrides = theme.light
      ? mapFluentToAppColors(theme.light.body, theme.light.header)
      : {};
    const darkOverrides = theme.dark
      ? mapFluentToAppColors(theme.dark.body, theme.dark.header)
      : {};

    setFluentOverrides({ light: lightOverrides, dark: darkOverrides });
  };

  // ---------------------------------------------------------------------------
  // Set theme + persist
  // ---------------------------------------------------------------------------

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    storage.set(THEME_PREF_KEY, mode);
  }, []);

  // ---------------------------------------------------------------------------
  // Memoize provider value to prevent unnecessary consumer re-renders
  // ---------------------------------------------------------------------------

  const value = useMemo(() => ({ theme, isDark, colors, setTheme, update, maintenance, branding, refreshAppConfig, setFromBatch }), [theme, isDark, colors, setTheme, update, maintenance, branding, refreshAppConfig, setFromBatch]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export default ThemeContext;
