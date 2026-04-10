// =============================================================================
// USE WIDGET PREFERENCES - Persist widget order
// =============================================================================
// Stores user's widget order in MMKV.
// Handles forward compatibility: new widgets appended, removed widgets dropped.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { getJSON, setJSON } from '@/services/storage';
import { getAvailableWidgets } from '@/components/home/widgetRegistry';
import { useFeatures } from '@/contexts/AppConfigContext';
import type { WidgetRegistration } from '@/modules/_types';
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
function buildDefaults(available: WidgetRegistration[]): WidgetPreferences {
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
  available: WidgetRegistration[],
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
  const features = useFeatures();
  const [preferences, setPreferences] = useState<WidgetPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load on mount (re-run when features change from server) — synchronous with MMKV
  useEffect(() => {
    const available = getAvailableWidgets(features);
    const saved = getJSON<WidgetPreferences>(STORAGE_KEY);
    if (saved) {
      const merged = mergePreferences(saved, available);
      setPreferences(merged);
      log.debug('loaded & merged widgets', { count: merged.order.length });
    } else {
      const defaults = buildDefaults(available);
      setPreferences(defaults);
      log.debug('using default widgets', { count: defaults.order.length });
    }
    setIsLoading(false);
  }, [features]);

  // Persist helper (synchronous)
  const persist = useCallback((prefs: WidgetPreferences) => {
    setJSON(STORAGE_KEY, prefs);
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

  return {
    preferences,
    isLoading,
    reorder,
  };
}
