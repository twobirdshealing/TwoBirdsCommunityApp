// =============================================================================
// STORAGE - MMKV-backed synchronous storage for the app
// =============================================================================
// Replaces AsyncStorage with react-native-mmkv for:
// - Synchronous reads (no async/await for cache loads)
// - 30x faster than AsyncStorage
// - JSI-based (no bridge overhead on New Architecture)
//
// All storage keys use the same 'tbc_' prefix convention.
// Auth tokens remain in expo-secure-store (encrypted) — NOT here.
// =============================================================================

import { createMMKV, type MMKV } from 'react-native-mmkv';

/** Default MMKV instance for all app storage */
export const storage: MMKV = createMMKV({ id: 'tbc-default' });

// -----------------------------------------------------------------------------
// Typed helpers (match the JSON read/write patterns the app already uses)
// -----------------------------------------------------------------------------

/**
 * Read a JSON value from storage (synchronous).
 * Returns null if key doesn't exist or parse fails.
 */
export function getJSON<T>(key: string): T | null {
  try {
    const raw = storage.getString(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Write a JSON value to storage (synchronous, fire-and-forget).
 */
export function setJSON(key: string, value: unknown): void {
  try {
    storage.set(key, JSON.stringify(value));
  } catch {
    // Silent fail — storage is nice-to-have, not critical
  }
}
