// =============================================================================
// USE WIDGET PREFERENCES - Persist widget order + visibility
// =============================================================================
// Stores user's widget order and enabled/disabled state in AsyncStorage.
// Handles forward compatibility: new widgets appended, removed widgets dropped.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAvailableWidgets, WidgetConfig } from '@/components/home/widgetRegistry';
import { createLogger } from '@/utils/logger';

const log = createLogger('WidgetPrefs');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

const STORAGE_KEY = 'tbc_widget_preferences';

export interface WidgetPreference {
  id: string;
  enabled: boolean;
}

interface WidgetPreferences {
  /** Ordered list of widget IDs + enabled state */
  order: WidgetPreference[];
  /** Schema version for future migrations */
  version: number;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Build default preferences from the registry */
function buildDefaults(available: WidgetConfig[]): WidgetPreferences {
  return {
    version: 1,
    order: available.map((w) => ({
      id: w.id,
      enabled: w.defaultEnabled,
    })),
  };
}

/**
 * Merge saved preferences with current available widgets.
 * - Preserves saved order + enabled state for known widgets.
 * - Appends any new widgets (added since last save) at the end with defaults.
 * - Removes any saved widgets that no longer exist in registry or fail feature flag.
 */
function mergePreferences(
  saved: WidgetPreferences,
  available: WidgetConfig[],
): WidgetPreferences {
  const availableIds = new Set(available.map((w) => w.id));
  const savedIds = new Set(saved.order.map((p) => p.id));

  // Keep saved entries that still exist in available
  const merged: WidgetPreference[] = saved.order.filter((p) =>
    availableIds.has(p.id),
  );

  // Append new widgets not in saved
  for (const w of available) {
    if (!savedIds.has(w.id)) {
      merged.push({ id: w.id, enabled: w.defaultEnabled });
    }
  }

  return { version: 1, order: merged };
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useWidgetPreferences() {
  const [preferences, setPreferences] = useState<WidgetPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load on mount
  useEffect(() => {
    (async () => {
      const available = getAvailableWidgets();
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved: WidgetPreferences = JSON.parse(raw);
          const merged = mergePreferences(saved, available);
          setPreferences(merged);
          log('loaded & merged', merged.order.length, 'widgets');
        } else {
          const defaults = buildDefaults(available);
          setPreferences(defaults);
          log('using defaults', defaults.order.length, 'widgets');
        }
      } catch {
        setPreferences(buildDefaults(available));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Persist helper
  const persist = useCallback(async (prefs: WidgetPreferences) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // Silent fail — preferences are nice-to-have, not critical
    }
  }, []);

  // Reorder widgets (called after drag ends)
  const reorder = useCallback(
    (newOrder: WidgetPreference[]) => {
      const updated: WidgetPreferences = { version: 1, order: newOrder };
      setPreferences(updated);
      persist(updated);
    },
    [persist],
  );

  // Toggle widget visibility
  const toggleWidget = useCallback(
    (widgetId: string) => {
      if (!preferences) return;
      const updated: WidgetPreferences = {
        ...preferences,
        order: preferences.order.map((p) =>
          p.id === widgetId ? { ...p, enabled: !p.enabled } : p,
        ),
      };
      setPreferences(updated);
      persist(updated);
    },
    [preferences, persist],
  );

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const available = getAvailableWidgets();
    const defaults = buildDefaults(available);
    setPreferences(defaults);
    persist(defaults);
  }, [persist]);

  return {
    preferences,
    isLoading,
    reorder,
    toggleWidget,
    resetToDefaults,
  };
}
