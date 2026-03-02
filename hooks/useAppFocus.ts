// =============================================================================
// USE APP FOCUS - Callback when app resumes from background
// =============================================================================
// Fires `onFocus` when the app transitions from background/inactive → active.
// Does NOT fire on initial mount — only on subsequent foreground transitions.
// Use `enabled` to gate activation (e.g., only when authenticated).
// =============================================================================

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useAppFocus(onFocus: () => void, enabled: boolean = true): void {
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;

  useEffect(() => {
    if (!enabled) return;

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const wasBackground = appStateRef.current.match(/inactive|background/);
      appStateRef.current = nextState;

      if (wasBackground && nextState === 'active') {
        onFocusRef.current();
      }
    });

    return () => subscription.remove();
  }, [enabled]);
}
