// =============================================================================
// CACHE EVENTS - Lightweight pub/sub for cross-screen cache invalidation
// =============================================================================
// Emitters call emit('feeds') after mutations (post create, comment add, etc.).
// Subscribers call their refresh function when the event fires.
//
// Used directly by manual-state screens (space page).
// Used internally by useAppQuery via the `invalidateOn` option.
// =============================================================================

/** Type-safe cache event keys — use CACHE_EVENTS.FEEDS instead of raw strings */
export const CACHE_EVENTS = {
  FEEDS: 'feeds',
  BOOKMARKS: 'bookmarks',
  SPACES: 'spaces',
  PROFILE: 'profile',
  THREADS: 'threads',
} as const;

export type CacheEvent = (typeof CACHE_EVENTS)[keyof typeof CACHE_EVENTS];

type Listener = () => void;

const listeners = new Map<CacheEvent, Set<Listener>>();

export const cacheEvents = {
  subscribe(event: CacheEvent, fn: Listener): () => void {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event)!.add(fn);
    return () => {
      listeners.get(event)!.delete(fn);
    };
  },

  emit(event: CacheEvent): void {
    listeners.get(event)?.forEach((fn) => fn());
  },
};
