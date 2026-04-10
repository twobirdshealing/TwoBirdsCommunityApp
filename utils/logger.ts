// =============================================================================
// LOGGER — Typed observability layer
// =============================================================================
// Feeds Sentry breadcrumbs + events in production when sinks are wired (see
// services/sentry.ts). Stays free of hard Sentry imports so it ships standalone
// and works identically pre-SDK-init.
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  /** Verbose dev tracing. Dropped in production. */
  debug(message: string, data?: Record<string, unknown>): void;
  /** Notable event. Console (dev) + Sentry breadcrumb (prod). */
  info(message: string, data?: Record<string, unknown>): void;
  /** Handled but unexpected. Console (dev) + Sentry breadcrumb level=warning (prod). */
  warn(message: string, data?: Record<string, unknown>): void;
  /**
   * Captured error. First arg MUST be the error (Error instance preferred
   * for stack traces; strings/unknowns are captured as messages).
   * Second arg is an optional human description of what was happening.
   * Third arg is optional structured context.
   *
   *   log.error(err)
   *   log.error(err, 'Failed to load space')
   *   log.error(err, 'Checkout failed', { cartId: 42 })
   */
  error(error: unknown, message?: string, context?: Record<string, unknown>): void;
  /** Returns a child logger with persistent context merged into every call. */
  withContext(context: Record<string, unknown>): Logger;
}

// -----------------------------------------------------------------------------
// Sink injection — populated by services/sentry.ts after Sentry.init().
// Module-level vars (not state) because the logger is used from non-React
// code. A hot reload replaces them via setLoggerSinks — no leak risk.
// -----------------------------------------------------------------------------

type BreadcrumbFn = (args: {
  category: string;
  message: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}) => void;

type CaptureFn = (
  error: unknown,
  args: { tag: string; message?: string; context?: Record<string, unknown> },
) => void;

let breadcrumbSink: BreadcrumbFn | null = null;
let captureSink: CaptureFn | null = null;

export function setLoggerSinks(opts: { breadcrumb: BreadcrumbFn; capture: CaptureFn }): void {
  breadcrumbSink = opts.breadcrumb;
  captureSink = opts.capture;
}

// -----------------------------------------------------------------------------
// Internal: shared logger implementation, parameterized by tag + base context
// -----------------------------------------------------------------------------

function buildLogger(tag: string, baseContext: Record<string, unknown> | null): Logger {
  const merge = (extra?: Record<string, unknown>): Record<string, unknown> | undefined => {
    if (!baseContext && !extra) return undefined;
    if (!baseContext) return extra;
    if (!extra) return baseContext;
    return { ...baseContext, ...extra };
  };

  const prefix = `[${tag}]`;

  const debug: Logger['debug'] = (message, data) => {
    // debug is dev-only by design — hard gate before any allocation
    if (!__DEV__) return;
    const ctx = merge(data);
    if (ctx) console.log(prefix, message, ctx);
    else console.log(prefix, message);
  };

  const info: Logger['info'] = (message, data) => {
    // Hot-path guard: nothing to do if neither dev console nor sink is active
    if (!__DEV__ && !breadcrumbSink) return;
    const ctx = merge(data);
    if (__DEV__) {
      if (ctx) console.log(prefix, message, ctx);
      else console.log(prefix, message);
    }
    breadcrumbSink?.({ category: tag, message, level: 'info', data: ctx });
  };

  const warn: Logger['warn'] = (message, data) => {
    if (!__DEV__ && !breadcrumbSink) return;
    const ctx = merge(data);
    if (__DEV__) {
      if (ctx) console.warn(prefix, message, ctx);
      else console.warn(prefix, message);
    }
    breadcrumbSink?.({ category: tag, message, level: 'warning', data: ctx });
  };

  const error: Logger['error'] = (err, message, context) => {
    if (!__DEV__ && !captureSink) return;
    const ctx = merge(context);
    if (__DEV__) {
      if (message && ctx) console.error(prefix, message, err, ctx);
      else if (message) console.error(prefix, message, err);
      else if (ctx) console.error(prefix, err, ctx);
      else console.error(prefix, err);
    }
    captureSink?.(err, { tag, message, context: ctx });
  };

  const withContext: Logger['withContext'] = (context) => {
    return buildLogger(tag, merge(context) ?? null);
  };

  return { debug, info, warn, error, withContext };
}

export function createLogger(tag: string): Logger {
  return buildLogger(tag, null);
}
