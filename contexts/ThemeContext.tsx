// =============================================================================
// THEME CONTEXT - Global theme state with Fluent color sync
// =============================================================================

import {
  ColorTheme,
  darkColors,
  lightColors,
  mapFluentToAppColors,
} from '@/constants/colors';
import { getThemeColors, ThemeColorsResponse } from '@/services/api/theme';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  isDark: boolean;
  colors: ColorTheme;
  setTheme: (mode: ThemeMode) => void;
}

// -----------------------------------------------------------------------------
// Storage Keys
// -----------------------------------------------------------------------------

const THEME_PREF_KEY = 'theme_preference';
const THEME_CACHE_KEY = 'theme_colors_cache';

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
        reactions: base.reactions,
        tabBar: overrides.tabBar?.background
          ? { ...base.tabBar, ...overrides.tabBar }
          : base.tabBar,
      };
    }

    return base;
  }, [isDark, fluentOverrides]);

  // ---------------------------------------------------------------------------
  // Load saved preference + cached colors on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    (async () => {
      try {
        // Load saved theme preference
        const savedPref = await SecureStore.getItemAsync(THEME_PREF_KEY);
        if (savedPref === 'light' || savedPref === 'dark') {
          setThemeState(savedPref);
        }
        // Legacy cleanup: if 'system' was stored, default to 'light'

        // Load cached Fluent colors
        const cachedColors = await SecureStore.getItemAsync(THEME_CACHE_KEY);
        if (cachedColors) {
          const parsed: ThemeColorsResponse = JSON.parse(cachedColors);
          applyFluentColors(parsed);
        }
      } catch (e) {
        // Silent fail — defaults are fine
      } finally {
        setIsReady(true);
      }

      // Background refresh
      refreshFluentColors();
    })();
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch fresh colors from API (background)
  // ---------------------------------------------------------------------------

  const refreshFluentColors = useCallback(async () => {
    const data = await getThemeColors();
    if (!data) return;

    // Cache for next launch
    try {
      await SecureStore.setItemAsync(THEME_CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      // SecureStore has size limits — if cache fails, colors still work from API
    }

    applyFluentColors(data);
  }, []);

  const applyFluentColors = (data: ThemeColorsResponse) => {
    if (!data.light && !data.dark) return;

    const lightOverrides = data.light
      ? mapFluentToAppColors(data.light.body, data.light.header)
      : {};
    const darkOverrides = data.dark
      ? mapFluentToAppColors(data.dark.body, data.dark.header)
      : {};

    setFluentOverrides({ light: lightOverrides, dark: darkOverrides });
  };

  // ---------------------------------------------------------------------------
  // Set theme + persist
  // ---------------------------------------------------------------------------

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      await SecureStore.setItemAsync(THEME_PREF_KEY, mode);
    } catch (e) {
      // Silent fail
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Don't render children until preference is loaded (prevents flash)
  // ---------------------------------------------------------------------------

  if (!isReady) return null;

  return (
    <ThemeContext.Provider value={{ theme, isDark, colors, setTheme }}>
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
