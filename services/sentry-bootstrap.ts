// =============================================================================
// SENTRY BOOTSTRAP — Side-effect module that initializes Sentry at first import
// =============================================================================
// Imported as the FIRST line of app/_layout.tsx (a bare side-effect import) so
// Sentry.init() runs before any other module's top-level code executes —
// meaning provider/hook setup errors thrown during import are captured.
//
// The DSN is read synchronously from MMKV (see crashReportingCache). First
// launch with no cached config silently skips init and waits for the next
// session — acceptable tradeoff vs. the complexity of deferring init to a
// React effect.
//
// Wrapped in try/catch because a failing init must not take down the bundle
// before React can mount — the whole point of this module is to REPORT
// crashes, not cause them.
// =============================================================================

import { initSentry } from '@/services/sentry';
import { getCrashReportingConfig } from '@/utils/crashReportingCache';

try {
  initSentry(getCrashReportingConfig());
} catch {
  // Swallowed on purpose — crash reporting is best-effort at startup.
}
