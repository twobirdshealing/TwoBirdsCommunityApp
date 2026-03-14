// =============================================================================
// THEME CONTEXT - Global theme state with Fluent color sync
// =============================================================================

import {
  ColorTheme,
  darkColors,
  lightColors,
  mapFluentToAppColors,
} from '@/constants/colors';
import { getAppConfig, AppConfigResponse, MaintenanceConfig, UpdateConfig, ThemeData, BrandingConfig } from '@/services/api/theme';
import { setSocialProviders } from '@/services/api/socialProviders';
import { createLogger } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [fluentOverrides, setFluentOverrides] = useState<{
    light: Partial<ColorTheme>;
    dark: Partial<ColorTheme>;
  } | null>(null);
  const [update, setUpdate] = useState<UpdateConfig | null>(null);
  const [maintenance, setMaintenance] = useState<MaintenanceConfig | null>(null);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [isReady, setIsReady] = useState(false);

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
  // Load saved preference + cached config on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        // Load saved theme preference
        const savedPref = await AsyncStorage.getItem(THEME_PREF_KEY);
        if (savedPref === 'light' || savedPref === 'dark') {
          setThemeState(savedPref);
        }

        // Load cached app config
        const cached = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
        if (cached) {
          const parsed: AppConfigResponse = JSON.parse(cached);
          applyAppConfig(parsed);
        }
      } catch (e) {
        // Silent fail — defaults are fine
      } finally {
        setIsReady(true);
      }

      // Background refresh
      refreshAppConfig();
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch fresh config from API (background)
  // ---------------------------------------------------------------------------

  const refreshAppConfig = useCallback(async () => {
    const data = await getAppConfig();
    if (!data) return;

    // Cache for next launch
    try {
      await AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      // Cache failed — data still works from API
    }

    applyAppConfig(data);
  }, []);

  const setFromBatch = useCallback((data: AppConfigResponse) => {
    applyAppConfig(data);
    // Also cache so next cold start has latest data
    AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(data)).catch((e) => log.warn('Config cache write failed:', e));
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

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      await AsyncStorage.setItem(THEME_PREF_KEY, mode);
    } catch (e) {
      // Silent fail
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Memoize provider value to prevent unnecessary consumer re-renders
  // ---------------------------------------------------------------------------

  const value = useMemo(() => ({ theme, isDark, colors, setTheme, update, maintenance, branding, refreshAppConfig, setFromBatch }), [theme, isDark, colors, setTheme, update, maintenance, branding, refreshAppConfig, setFromBatch]);

  // ---------------------------------------------------------------------------
  // Don't render children until preference is loaded (prevents flash)
  // ---------------------------------------------------------------------------

  if (!isReady) return null;

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
