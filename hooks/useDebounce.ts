// =============================================================================
// useDebounce - Debounce a value across renders
// =============================================================================
// Returns the input value updated only after `delay` ms of no further changes.
// Used by user-search inputs (NewMessageModal, MultiSelectUserPicker) to avoid
// firing an API request on every keystroke.
// =============================================================================

import { useEffect, useState } from 'react';

/**
 * Debounce a rapidly-changing value. The returned value lags `value` by `delay`
 * ms — it only updates after the input has stopped changing for that interval.
 *
 * @example
 *   const [query, setQuery] = useState('');
 *   const debounced = useDebounce(query, 300);
 *   useEffect(() => { runSearch(debounced); }, [debounced]);
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default useDebounce;
