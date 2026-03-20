// =============================================================================
// USE APP QUERY - TanStack Query adapter (replaces useCachedData)
// =============================================================================
// Drop-in replacement for useCachedData that uses TanStack Query internally.
// Same API surface so consumers migrate with minimal changes.
//
// What TanStack Query handles automatically:
// - Stale-while-revalidate (show cached → fetch fresh in background)
// - Deduplication (multiple components requesting same key = 1 fetch)
// - Background refetch on app focus (via focusManager in queryClient.ts)
// - Garbage collection of unused queries
// - MMKV persistence (via PersistQueryClientProvider in _layout.tsx)
//
// Usage (screen):
//   const { data, isLoading, refresh } = useAppQuery({
//     cacheKey: 'tbc_activity_feeds',
//     fetcher: () => feedsApi.getFeeds({ per_page: 20 }),
//   });
//
// Usage (widget):
//   const { data, isLoading } = useAppQuery({
//     cacheKey: 'tbc_widget_events',
//     fetcher: () => fetchEvents(),
//     refreshKey,
//     staleTime: WIDGET_STALE_TIME,
//   });
// =============================================================================

import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cacheEvents, CacheEvent } from '@/utils/cacheEvents';

// -----------------------------------------------------------------------------
// Types (same interface as old useCachedData)
// -----------------------------------------------------------------------------

interface UseAppQueryOptions<T> {
  /** Query key string. Include dynamic segments for param-based keys. */
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
  /** Skip network fetch if data was fetched within this many ms.
   *  Default: 0 (always fetch on focus — best for screens).
   *  Widgets should use WIDGET_STALE_TIME (120s). */
  staleTime?: number;
}

interface UseAppQueryResult<T> {
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

/** Default staleTime for widgets (2 min). Screens keep 0 for live data. */
export const WIDGET_STALE_TIME = 120_000;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAppQuery<T>({
  cacheKey,
  fetcher,
  refreshKey = 0,
  refreshOnFocus = true,
  enabled = true,
  invalidateOn,
  staleTime = 0,
}: UseAppQueryOptions<T>): UseAppQueryResult<T> {
  const queryClient = useQueryClient();

  // refreshKey is part of queryKey — when it changes, TanStack Query refetches.
  // Memoized to stabilize mutate/effect dependencies.
  const queryKey = useMemo(
    () => refreshKey > 0 ? [cacheKey, refreshKey] : [cacheKey],
    [cacheKey, refreshKey],
  );

  const query = useQuery<T, Error>({
    queryKey,
    queryFn: fetcher,
    enabled,
    staleTime,
    refetchOnWindowFocus: refreshOnFocus,
  });

  // -- Cache event invalidation (cross-screen refresh) --
  useEffect(() => {
    if (!invalidateOn || !enabled) return;
    return cacheEvents.subscribe(invalidateOn, () => {
      queryClient.invalidateQueries({ queryKey: [cacheKey] });
    });
  }, [invalidateOn, enabled, cacheKey, queryClient]);

  // -- Imperative refresh (for pull-to-refresh) --
  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: [cacheKey] });
  }, [cacheKey, queryClient]);

  // -- Mutate (for optimistic updates) --
  const mutate = useCallback(
    (updater: T | ((prev: T | null) => T | null)) => {
      queryClient.setQueryData<T>(queryKey, (old) => {
        const prev = old ?? null;
        if (typeof updater === 'function') {
          return (updater as (prev: T | null) => T | null)(prev) ?? undefined;
        }
        return updater;
      });
    },
    [queryKey, queryClient],
  );

  return {
    data: query.data ?? null,
    isLoading: query.isLoading,
    isRefreshing: query.isFetching && !query.isLoading,
    error: query.error ?? null,
    refresh,
    mutate,
  };
}

// -----------------------------------------------------------------------------
// Adapter: wraps useAppQuery's mutate into a SetStateAction<T[]> dispatcher
// -----------------------------------------------------------------------------

/**
 * Adapts useAppQuery's mutate into a standard React.Dispatch<SetStateAction<T[]>>
 * that treats null as empty array. Used by feed screens for useFeedActions/useFeedReactions.
 */
export function useArrayMutate<T>(
  mutate: (updater: T[] | ((prev: T[] | null) => T[] | null)) => void,
): React.Dispatch<React.SetStateAction<T[]>> {
  return useCallback(
    (action: React.SetStateAction<T[]>) => {
      mutate((prev) => {
        const current = prev || [];
        return typeof action === 'function' ? action(current) : action;
      });
    },
    [mutate],
  );
}
