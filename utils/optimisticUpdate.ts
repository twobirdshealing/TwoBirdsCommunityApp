// =============================================================================
// OPTIMISTIC UPDATE - Shared utility for optimistic state updates with rollback
// =============================================================================
// Pattern: snapshot → apply update → await API → revert on failure
//
// Handles both thrown errors and API-level failures ({ success: false }).
// Returns the ApiResponse so callers can handle success cases (reconcile
// with server data, show alerts, emit cache events, etc.).
//
// Usage:
//   const response = await optimisticUpdate(
//     setFeeds,
//     prev => prev.map(f => f.id === id ? { ...f, pinned: true } : f),
//     () => feedsApi.toggleSticky(id, true),
//   );
// =============================================================================

import type { ApiResponse } from '@/services/api/client';

/**
 * Performs an optimistic state update with automatic rollback on failure.
 *
 * 1. Captures current state as a snapshot inside the updater
 * 2. Applies the optimistic update immediately
 * 3. Awaits the API call
 * 4. On failure ({ success: false } or thrown error): reverts to snapshot
 * 5. Returns the ApiResponse for the caller to handle success
 */
export async function optimisticUpdate<T, R>(
  setState: (updater: (prev: T) => T) => void,
  updater: (prev: T) => T,
  apiCall: () => Promise<ApiResponse<R>>,
): Promise<ApiResponse<R>> {
  let snapshot!: T;

  setState((prev) => {
    snapshot = prev;
    return updater(prev);
  });

  try {
    const response = await apiCall();
    if (!response.success) {
      setState(() => snapshot);
    }
    return response;
  } catch (error) {
    setState(() => snapshot);
    throw error;
  }
}
