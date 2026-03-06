// =============================================================================
// USE CACHED DATA - Stale-while-revalidate data fetching for all screens
// =============================================================================
// The unified data hook for the entire app. Every screen and widget uses this.
//
// Flow:
// 1. Mount → load from AsyncStorage (instant) → fetch fresh in background
// 2. refreshKey changes → fetch fresh (parent-driven, e.g. pull-to-refresh)
// 3. App resumes from background → fetch fresh (via useAppFocus)
// 4. refresh() called → fetch fresh (imperative pull-to-refresh)
// 5. mutate() called → update state + persist (optimistic updates)
// 6. invalidateOn event fires → fetch fresh (cross-screen cache invalidation)
//
// Usage (screen):
//   const { data, isLoading, refresh } = useCachedData({
//     cacheKey: 'tbc_activity_feeds',
//     fetcher: () => feedsApi.getFeeds({ per_page: 20 }),
//   });
//
// Usage (widget — parent drives refresh via refreshKey):
//   const { data, isLoading } = useCachedData({
//     cacheKey: 'tbc_widget_events',
//     fetcher: () => fetchEvents(),
//     refreshKey,
//     refreshOnFocus: false,
//   });
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '@/utils/logger';
import { cacheEvents, CacheEvent } from '@/utils/cacheEvents';
import { isBatchFresh } from '@/utils/batchCache';
import { useAppFocus } from './useAppFocus';

const log = createLogger('CachedData');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseCachedDataOptions<T> {
  /** AsyncStorage key. Include dynamic segments for param-based keys (e.g. `tbc_calendar_${month}`). */
  cacheKey: string;
  /** Async function that fetches and returns the data. Should throw on failure. */
  fetcher: () => Promise<T>;
  /** Changes trigger re-fetch (for parent-driven refresh like widgets). */
  refreshKey?: number;
  /** Refetch when app resumes from background. Default: true. */
  refreshOnFocus?: boolean;
  /** Gate all fetching. Default: true. */
  enabled?: boolean;
  /** Auto-refresh when this cache event fires (cross-screen invalidation). */
  invalidateOn?: CacheEvent;
  /** Skip network fetch if data was fetched within this many ms. Does NOT apply
      to imperative refresh() or cache event invalidation. Default: 0 (always fetch). */
  staleTime?: number;
}

interface UseCachedDataResult<T> {
  /** Cached or fresh data (null until first load) */
  data: T | null;
  /** True only on first load when no cache exists */
  isLoading: boolean;
  /** True during background/pull refresh (after initial load) */
  isRefreshing: boolean;
  /** Error from last fetch attempt (null on success) */
  error: Error | null;
  /** Imperative refresh — for pull-to-refresh */
  refresh: () => Promise<void>;
  /** Update data locally + persist to cache (for optimistic updates) */
  mutate: (updater: T | ((prev: T | null) => T | null)) => void;
}

// Min ms between focus-triggered refreshes
const FOCUS_COOLDOWN_MS = 5000;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useCachedData<T>({
  cacheKey,
  fetcher,
  refreshKey = 0,
  refreshOnFocus = true,
  enabled = true,
  invalidateOn,
  staleTime = 0,
}: UseCachedDataOptions<T>): UseCachedDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isMounted = useRef(true);
  const initialLoadDone = useRef(false);
  const lastFetchTime = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  // -- Persist to AsyncStorage (fire-and-forget) --
  const persist = useCallback(
    (value: T) => {
      AsyncStorage.setItem(cacheKey, JSON.stringify(value)).catch(() => {});
    },
    [cacheKey],
  );

  // -- Core fetch function --
  // silent=true skips the isRefreshing flag (no pull-to-refresh spinner flash)
  const fetchFresh = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsRefreshing(true);
      const result = await fetcherRef.current();
      if (isMounted.current) {
        setData(result);
        setIsLoading(false);
        setIsRefreshing(false);
        setError(null);
        persist(result);
        lastFetchTime.current = Date.now();
        log(cacheKey, 'refreshed from network');
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [cacheKey, persist]);

  // -- Initial mount: cache read → background fetch (skipped if batch-fresh) --
  useEffect(() => {
    if (!enabled) return;

    isMounted.current = true;
    initialLoadDone.current = false;

    (async () => {
      // 1. Try loading from cache
      let hasCachedData = false;
      try {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && isMounted.current) {
          setData(JSON.parse(cached));
          setIsLoading(false);
          hasCachedData = true;
          log(cacheKey, 'loaded from cache');
        }
      } catch {
        // Cache read failed — will wait for network
      }

      // 2. Skip network fetch if startup batch just wrote this cache key.
      //    The batch already populated AsyncStorage with fresh data above.
      //    Subsequent refreshes (focus, pull-to-refresh, refreshKey) still work.
      if (hasCachedData && isBatchFresh(cacheKey)) {
        log(cacheKey, 'skipping initial fetch — batch-fresh');
        lastFetchTime.current = Date.now();
        initialLoadDone.current = true;
        return;
      }

      // 3. Fetch fresh in background
      await fetchFresh();
      initialLoadDone.current = true;
    })();

    return () => {
      isMounted.current = false;
    };
  }, [cacheKey, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- RefreshKey changes (after initial load, respects staleTime) --
  useEffect(() => {
    if (!initialLoadDone.current || !enabled) return;
    if (staleTime > 0 && Date.now() - lastFetchTime.current < staleTime) {
      log(cacheKey, 'skipping refreshKey — still fresh');
      return;
    }
    fetchFresh();
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // -- App focus refresh (uses staleTime if set, otherwise FOCUS_COOLDOWN_MS) --
  useAppFocus(
    useCallback(() => {
      if (!initialLoadDone.current) return;
      const cooldown = staleTime > 0 ? staleTime : FOCUS_COOLDOWN_MS;
      if (Date.now() - lastFetchTime.current < cooldown) return;
      fetchFresh();
    }, [fetchFresh, staleTime]),
    enabled && refreshOnFocus,
  );

  // -- Cache event invalidation (cross-screen refresh, silent — no spinner) --
  useEffect(() => {
    if (!invalidateOn || !enabled) return;
    return cacheEvents.subscribe(invalidateOn, () => fetchFresh(true));
  }, [invalidateOn, enabled, fetchFresh]);

  // -- Imperative refresh (for pull-to-refresh) --
  const refresh = useCallback(async () => {
    await fetchFresh();
  }, [fetchFresh]);

  // -- Mutate (for optimistic updates) --
  const mutate = useCallback(
    (updater: T | ((prev: T | null) => T | null)) => {
      setData((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (prev: T | null) => T | null)(prev)
            : updater;
        if (next !== null) {
          persist(next);
        }
        return next;
      });
    },
    [persist],
  );

  return { data, isLoading, isRefreshing, error, refresh, mutate };
}
