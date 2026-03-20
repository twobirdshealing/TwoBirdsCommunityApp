// =============================================================================
// QUERY CLIENT - TanStack Query configuration with MMKV persistence
// =============================================================================
// Central QueryClient for the entire app. Configured with:
// - MMKV-backed persistence (query cache survives app restarts)
// - React Native focus/online managers (refetch on app resume)
// - Sensible defaults for mobile (staleTime, gcTime, retry)
// =============================================================================

import { QueryClient, focusManager, onlineManager } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { storage } from '@/services/storage';

// -----------------------------------------------------------------------------
// React Native Focus Manager — refetch when app returns to foreground
// -----------------------------------------------------------------------------

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener('change', (state) => {
    handleFocus(state === 'active');
  });
  return () => subscription.remove();
});

// -----------------------------------------------------------------------------
// React Native Online Manager — pause queries when offline
// -----------------------------------------------------------------------------

onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

// -----------------------------------------------------------------------------
// Query Client
// -----------------------------------------------------------------------------

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is fresh for 0ms by default (screens always refetch on focus).
      // Widgets override this with their own staleTime.
      staleTime: 0,
      // Keep unused queries in cache for 30 minutes
      gcTime: 1000 * 60 * 30,
      // Retry once on failure
      retry: 1,
      // Refetch when app comes back to foreground
      refetchOnWindowFocus: true,
      // Don't refetch on reconnect by default (focus handles it)
      refetchOnReconnect: false,
    },
  },
});

// -----------------------------------------------------------------------------
// MMKV Persister — survives app restarts
// -----------------------------------------------------------------------------

/** MMKV-backed sync persister for TanStack Query cache */
export const queryPersister = createSyncStoragePersister({
  storage: {
    getItem: (key: string) => storage.getString(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => { storage.remove(key); },
  },
  // Throttle writes to MMKV (every 1s max)
  throttleTime: 1000,
});
