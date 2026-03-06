// =============================================================================
// TAB BAR CONTEXT - Auto-hide tab bar on scroll
// =============================================================================
// Provides scroll-aware tab bar visibility for tab screens.
// Scroll direction is detected via plain JS onScroll (FlashList compatible),
// animation runs on the UI thread via Reanimated SharedValue.
// =============================================================================

import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSharedValue, withTiming, SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sizing, animation } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface TabBarContextType {
  /** Reanimated shared value: 0 = fully visible, positive = hidden */
  translateY: SharedValue<number>;
  /** Attach to any FlashList/ScrollView onScroll to drive hide/show */
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Force tab bar visible (e.g. on tab switch) */
  showTabBar: () => void;
  /** Lock tab bar visible and disable scroll-hiding (e.g. edit mode) */
  setLocked: (locked: boolean) => void;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SCROLL_THRESHOLD = 10; // px before reacting to direction change

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const TabBarContext = createContext<TabBarContextType | null>(null);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function TabBarProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  // Generous hide distance: tab bar + safe area + mini player headroom
  const hideDistance = sizing.height.tabBar + insets.bottom + 80;

  const translateY = useSharedValue(0);
  const lastScrollY = useRef(0);
  const accumulatedDelta = useRef(0);
  const isLocked = useRef(false);

  const showTabBar = useCallback(() => {
    translateY.value = withTiming(0, { duration: animation.normal });
  }, [translateY]);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isLocked.current) return;

      const currentY = event.nativeEvent.contentOffset.y;
      const delta = currentY - lastScrollY.current;
      lastScrollY.current = currentY;

      // Near the top — always show tab bar
      if (currentY <= 0) {
        accumulatedDelta.current = 0;
        if (translateY.value !== 0) {
          translateY.value = withTiming(0, { duration: animation.normal });
        }
        return;
      }

      // Reset accumulated delta when direction reverses
      if (
        (delta > 0 && accumulatedDelta.current < 0) ||
        (delta < 0 && accumulatedDelta.current > 0)
      ) {
        accumulatedDelta.current = 0;
      }
      accumulatedDelta.current += delta;

      // Only react after threshold is exceeded
      if (accumulatedDelta.current > SCROLL_THRESHOLD) {
        // Scrolling DOWN — hide
        translateY.value = withTiming(hideDistance, { duration: animation.normal });
      } else if (accumulatedDelta.current < -SCROLL_THRESHOLD) {
        // Scrolling UP — show
        translateY.value = withTiming(0, { duration: animation.normal });
      }
    },
    [translateY, hideDistance],
  );

  const setLocked = useCallback(
    (locked: boolean) => {
      isLocked.current = locked;
      if (locked) {
        translateY.value = withTiming(0, { duration: animation.normal });
      }
    },
    [translateY],
  );

  const value = useMemo(() => ({
    translateY, handleScroll, showTabBar, setLocked,
  }), [translateY, handleScroll, showTabBar, setLocked]);

  return (
    <TabBarContext.Provider value={value}>
      {children}
    </TabBarContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useTabBar() {
  const ctx = useContext(TabBarContext);
  if (!ctx) throw new Error('useTabBar must be used within TabBarProvider');
  return ctx;
}
