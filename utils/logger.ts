// =============================================================================
// LOGGER - Shared debug logger factory
// =============================================================================
// Creates tagged loggers that only output in __DEV__ mode.
// Usage: const log = createLogger('API');  →  log('request', url);
// =============================================================================

/**
 * Create a tagged debug logger.
 * Returns a no-op in production builds for zero overhead.
 */
export function createLogger(tag: string) {
  if (__DEV__) {
    return (...args: any[]) => console.log(`[${tag}]`, ...args);
  }
  return (..._args: any[]) => {};
}
