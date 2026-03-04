// =============================================================================
// CACHE EVENTS - Lightweight pub/sub for cross-screen cache invalidation
// =============================================================================
// Emitters call emit('feeds') after mutations (post create, comment add, etc.).
// Subscribers call their refresh function when the event fires.
//
// Used directly by manual-state screens (space page).
// Used internally by useCachedData via the `invalidateOn` option.
// =============================================================================

export type CacheEvent = 'feeds' | 'bookmarks' | 'spaces' | 'profile';

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
