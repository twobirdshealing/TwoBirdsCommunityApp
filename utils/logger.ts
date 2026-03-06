// =============================================================================
// LOGGER - Shared debug logger factory
// =============================================================================
// Creates tagged loggers that only output in __DEV__ mode.
// Usage: const log = createLogger('API');
//        log('request', url);
//        log.warn('slow response');
//        log.error('failed', err);
// =============================================================================

type LogFn = (...args: any[]) => void;
type Logger = LogFn & { warn: LogFn; error: LogFn };

const noop: LogFn = () => {};

export function createLogger(tag: string): Logger {
  if (__DEV__) {
    return Object.assign(
      (...args: any[]) => console.log(`[${tag}]`, ...args),
      {
        warn: (...args: any[]) => console.warn(`[${tag}]`, ...args),
        error: (...args: any[]) => console.error(`[${tag}]`, ...args),
      },
    );
  }
  return Object.assign(noop, { warn: noop, error: noop });
}
