// =============================================================================
// BOTTOM OFFSET CONTEXT - Extra height above the tab bar (from module addons)
// =============================================================================
// Modules can render persistent UI above the tab bar (e.g., mini player, cart
// bar) via tabBarAddon. The tab bar measures the addon height and sets it here.
// Screens use useBottomOffset() to account for this extra height in padding.
// =============================================================================

import React, { createContext, useContext, useState, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sizing, spacing } from '@/constants/layout';

interface BottomOffsetContextType {
  /** Extra height above the tab bar from module addons (0 when none) */
  addonHeight: number;
  /** Called by the tab bar when addon area is measured via onLayout */
  setAddonHeight: (h: number) => void;
}

const BottomOffsetContext = createContext<BottomOffsetContextType>({
  addonHeight: 0,
  setAddonHeight: () => {},
});

export function BottomOffsetProvider({ children }: { children: React.ReactNode }) {
  const [addonHeight, setHeight] = useState(0);

  const setAddonHeight = useCallback((h: number) => {
    setHeight((prev) => (prev === h ? prev : h));
  }, []);

  return (
    <BottomOffsetContext.Provider value={{ addonHeight, setAddonHeight }}>
      {children}
    </BottomOffsetContext.Provider>
  );
}

/** Returns the extra height above the tab bar from module addons */
export function useBottomOffset(): number {
  return useContext(BottomOffsetContext).addonHeight;
}

/** Returns the setter — only used by the tab bar layout */
export function useSetAddonHeight(): (h: number) => void {
  return useContext(BottomOffsetContext).setAddonHeight;
}

/** Bottom padding for scrollable tab content: tab bar + safe area + addon + spacing */
export function useTabContentPadding(): number {
  const addonHeight = useBottomOffset();
  const insets = useSafeAreaInsets();
  return sizing.height.tabBar + insets.bottom + addonHeight + spacing.md;
}
