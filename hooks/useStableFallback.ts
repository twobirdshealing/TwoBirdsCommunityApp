// =============================================================================
// useStableFallback - Stable identity for `value ?? fallback` in hook deps
// =============================================================================
// Plain `data?.field || []` creates a fresh array reference every render,
// breaking downstream useEffect / useMemo deps that key off the result.
// useStableFallback memoizes the expression so the returned value's identity
// changes only when the source `value`'s identity actually changes.
//
// The fallback is captured once on first render via useRef, so callers can
// pass inline literals (`[]`, `{}`) without those churning the result. Pass a
// fallback that is conceptually constant — if you need a dynamic fallback,
// fold the logic into a regular useMemo instead.
//
// Used by feed / messaging / spaces screens that read paginated lists from
// useAppQuery and pass them as deps to other hooks.
// =============================================================================

import { useMemo, useRef } from 'react';

/**
 * Returns `value` when it's non-nullish, otherwise the fallback captured on
 * first render. Memoized so the returned reference is stable across renders
 * for the same `value` — safe to use as a dep in useEffect / useMemo /
 * useCallback.
 *
 * @example
 *   // Paginated list defaulting to []
 *   const items = useStableFallback(data?.items, []);
 *
 *   useEffect(() => {
 *     subscribeToItems(items);
 *   }, [items]); // only re-runs when items identity actually changes
 */
export function useStableFallback<T>(value: T | null | undefined, fallback: T): T {
  const fallbackRef = useRef(fallback);
  return useMemo(() => value ?? fallbackRef.current, [value]);
}
