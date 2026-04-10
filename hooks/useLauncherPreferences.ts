// =============================================================================
// USE LAUNCHER PREFERENCES - Persist launcher item order
// =============================================================================
// Stores user's preferred launcher grid order in MMKV.
// Handles forward compatibility: new items appended, removed items dropped.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import { getJSON, setJSON } from '@/services/storage';
import { createLogger } from '@/utils/logger';

const log = createLogger('LauncherPrefs');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

const STORAGE_KEY = 'tbc_launcher_order';

interface LauncherPreferences {
  /** Ordered list of item IDs */
  order: string[];
  /** Schema version for future migrations */
  version: number;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Merge saved order with current available IDs.
 * - Preserves saved order for IDs that still exist.
 * - Appends new IDs (not in saved) at the end.
 * - Drops saved IDs that no longer exist.
 */
function mergeOrder(savedOrder: string[], availableIds: string[]): string[] {
  const available = new Set(availableIds);
  const savedSet = new Set(savedOrder);

  // Keep saved entries that still exist
  const merged = savedOrder.filter((id) => available.has(id));

  // Append new IDs not in saved
  for (const id of availableIds) {
    if (!savedSet.has(id)) {
      merged.push(id);
    }
  }

  return merged;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useLauncherPreferences(availableIds: string[]) {
  const [orderedIds, setOrderedIds] = useState<string[]>(availableIds);

  // Load + merge on mount / when availableIds change (synchronous with MMKV)
  useEffect(() => {
    const saved = getJSON<LauncherPreferences>(STORAGE_KEY);
    if (saved) {
      const merged = mergeOrder(saved.order, availableIds);
      setOrderedIds(merged);
      log.debug('loaded & merged items', { count: merged.length });
    } else {
      setOrderedIds(availableIds);
      log.debug('using defaults', { count: availableIds.length });
    }
  }, [availableIds]);

  // Reorder (called after drag ends)
  const reorder = useCallback((newOrder: string[]) => {
    setOrderedIds(newOrder);
    setJSON(STORAGE_KEY, { version: 1, order: newOrder } satisfies LauncherPreferences);
  }, []);

  return { orderedIds, reorder };
}
