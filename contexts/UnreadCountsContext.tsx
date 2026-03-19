// =============================================================================
// UNREAD COUNTS CONTEXT - Shared notification & message badge counts
// =============================================================================
// Single source of truth for unread counts used by:
// - TopHeader (in-app badge icons)
// - _layout.tsx badge sync (OS app icon badge)
// - useStartupData (batch populates initial counts)
// - PusherContext (real-time message bump)
// - Push notification listener (real-time notification bump)
//
// Eliminates the duplicate notification/unread fetch that previously
// happened from both _layout.tsx and TopHeader independently.
// =============================================================================

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UnreadCountsContextType {
  unreadNotifications: number;
  unreadMessages: number;
  setUnreadNotifications: (count: number | ((prev: number) => number)) => void;
  setUnreadMessages: (count: number | ((prev: number) => number)) => void;
  /** Reset all counts (e.g. on logout) */
  resetCounts: () => void;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const UnreadCountsContext = createContext<UnreadCountsContextType | undefined>(undefined);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function UnreadCountsProvider({ children }: { children: React.ReactNode }) {
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const resetCounts = useCallback(() => {
    setUnreadNotifications(0);
    setUnreadMessages(0);
  }, []);

  const value = useMemo(() => ({
    unreadNotifications,
    unreadMessages,
    setUnreadNotifications,
    setUnreadMessages,
    resetCounts,
  }), [unreadNotifications, unreadMessages, resetCounts]);

  return (
    <UnreadCountsContext.Provider value={value}>
      {children}
    </UnreadCountsContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useUnreadCounts() {
  const context = useContext(UnreadCountsContext);
  if (context === undefined) {
    throw new Error('useUnreadCounts must be used within an UnreadCountsProvider');
  }
  return context;
}
