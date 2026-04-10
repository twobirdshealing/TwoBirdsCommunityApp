// =============================================================================
// SENTRY — Crash reporting initialization
// =============================================================================
// Single entry point for Sentry. Handles:
//   1. SDK initialization (called from app/_layout.tsx at module-load time)
//   2. Wiring the typed logger to Sentry sinks (breadcrumbs + captures)
//
// All other code in the app talks to Sentry via the logger (createLogger),
// not by importing this file directly.
// =============================================================================

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import type { ComponentType } from 'react';
import { APP_VERSION } from '@/constants/config';
import { setLoggerSinks } from '@/utils/logger';
import type { CrashReportingConfig } from '@/services/api/appConfig';

// Module-level guard so Sentry.init() is idempotent even if this module is
// imported from multiple places during HMR or fast refresh.
let initialized = false;

// Last-seen config (masked DSN) — surfaced in the dev debug menu so you can
// confirm at a glance which DSN was loaded without exposing the full string.
let lastConfig: { enabled: boolean; dsnHost: string } | null = null;

/** True if Sentry.init() has run this session. Read by the debug menu. */
export function isSentryInitialized(): boolean {
  return initialized;
}

/** Returns the masked config that initSentry was last called with, or null. */
export function getSentryStatus(): { enabled: boolean; dsnHost: string } | null {
  return lastConfig;
}

/**
 * Initialize Sentry with the buyer-configured DSN. No-op if:
 *   - already initialized this session
 *   - config is null (first launch, no cached config yet)
 *   - enabled flag is false
 *   - DSN is empty
 *
 * Safe to call from a module body — Sentry's React Native SDK supports
 * synchronous initialization at any point in the JS lifecycle.
 */
export function initSentry(config: CrashReportingConfig | null): void {
  if (initialized) return;
  if (!config || !config.enabled || !config.dsn) return;

  // Stash a masked snapshot of the config so the dev debug menu can render
  // a "Sentry status" row without ever exposing the full DSN.
  try {
    const url = new URL(config.dsn);
    lastConfig = { enabled: true, dsnHost: url.host };
  } catch {
    lastConfig = { enabled: true, dsnHost: '(unparseable)' };
  }

  const buildNumber =
    Constants.expoConfig?.ios?.buildNumber ??
    String(Constants.expoConfig?.android?.versionCode ?? '0');

  Sentry.init({
    dsn: config.dsn,
    release: APP_VERSION,
    dist: String(buildNumber),
    environment: __DEV__ ? 'development' : 'production',
    // No performance/tracing — keep free-tier headroom for actual errors.
    tracesSampleRate: 0,
    enableAutoSessionTracking: true,
    attachStacktrace: true,
    // Strip Authorization headers from network breadcrumbs before sending.
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        const headers = (breadcrumb.data as Record<string, unknown> | undefined)?.request_headers;
        if (headers && typeof headers === 'object') {
          delete (headers as Record<string, unknown>).Authorization;
        }
      }
      return breadcrumb;
    },
  });

  // Wire the typed logger to Sentry. Every log.info / log.warn becomes a
  // breadcrumb; every log.error becomes a captureException event.
  setLoggerSinks({
    breadcrumb: ({ category, message, level, data }) => {
      Sentry.addBreadcrumb({ category, message, level, data });
    },
    capture: (error, { tag, message, context }) => {
      const tags = { source: tag };
      // Fold the human description into `extra` so it surfaces next to the
      // stack trace in the Sentry event view instead of getting lost in tags.
      const extra = message ? { description: message, ...(context ?? {}) } : context;
      const contexts = extra ? { custom: extra } : undefined;

      if (error instanceof Error) {
        Sentry.captureException(error, { tags, ...(contexts ? { contexts } : {}) });
        return;
      }

      // Non-Error values — fall back to captureMessage. Prefer the caller's
      // description over the stringified value for the event title.
      const title = message ?? (typeof error === 'string' ? error : 'logger.error called with non-Error value');
      Sentry.captureMessage(title, {
        level: 'error',
        tags,
        contexts: {
          ...(contexts ?? {}),
          error_value: { value: String(error) },
        },
      });
    },
  });

  initialized = true;
}

/**
 * Wrap the root component with Sentry's HOC. Enables automatic navigation
 * breadcrumbs and the React profiler integration.
 *
 * Returns the component as-is when Sentry isn't initialized — Sentry.wrap
 * itself prints a warning if init hasn't happened, so we gate it here to
 * avoid noise on first launch (no DSN cached yet).
 */
export function wrapWithSentry(
  Component: ComponentType<Record<string, unknown>>,
): ComponentType<Record<string, unknown>> {
  return initialized ? Sentry.wrap(Component) : Component;
}

/**
 * Force-flush queued Sentry events. Used by the dev "Send test event" button
 * to guarantee the event reaches Sentry's servers before showing a success
 * Alert (otherwise the user could background the app and lose the in-flight
 * request). Returns true if all events flushed within Sentry's default
 * flush timeout (the React Native SDK ignores per-call timeout args).
 */
export async function flushSentry(): Promise<boolean> {
  if (!initialized) return false;
  try {
    return await Sentry.flush();
  } catch {
    return false;
  }
}
