// =============================================================================
// CRASH REPORTING CACHE — Synchronous MMKV read for module-load Sentry init
// =============================================================================
// app/_layout.tsx calls Sentry.init() at module-load time (BEFORE React) so
// it needs the DSN synchronously, before AppConfigContext hydrates. MMKV
// reads are sync via JSI — no async bridge needed.
//
// AppConfigContext writes to this cache whenever fresh config arrives from
// the server. First launch of a fresh install reads null (no cached config)
// and Sentry stays uninitialized for that one session; every subsequent
// launch initializes from the cached value.
// =============================================================================

import { getJSON, setJSON } from '@/services/storage';
import type { CrashReportingConfig } from '@/services/api/appConfig';

export const CRASH_REPORTING_CACHE_KEY = 'tbc_crash_reporting_cache';

/**
 * Read the cached crash-reporting config. Returns null if nothing is cached
 * yet — caller should treat that as "crash reporting disabled" and skip
 * Sentry.init(). Called exactly once per cold start from app/_layout.tsx.
 */
export function getCrashReportingConfig(): CrashReportingConfig | null {
  return getJSON<CrashReportingConfig>(CRASH_REPORTING_CACHE_KEY);
}

/**
 * Write the latest config to MMKV. Called by AppConfigContext when fresh
 * config arrives from the server.
 */
export function setCrashReportingCache(cfg: CrashReportingConfig): void {
  setJSON(CRASH_REPORTING_CACHE_KEY, cfg);
}
