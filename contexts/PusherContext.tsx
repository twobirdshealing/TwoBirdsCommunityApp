// =============================================================================
// PUSHER CONTEXT - Global real-time messaging state
// =============================================================================
// Manages Pusher connection lifecycle and provides event subscription hooks.
// Automatically connects when user is authenticated, disconnects on logout.
// Reconnects when app returns from background (v2.2.0).
// =============================================================================

import { useAppConfig } from '@/contexts/AppConfigContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearHandlers,
  disconnectPusher,
  initializePusher,
  reconnectPusher,
  MessageHandler,
  onNewMessage,
  onReaction,
  ReactionHandler,
} from '@/services/pusher';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from 'react';
import { useAppFocus } from '@/hooks/useAppFocus';
import { useTickerPolling } from '@/hooks/useTickerPolling';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PusherContextType {
  isConnected: boolean;
  subscribeToMessages: (handler: MessageHandler) => () => void;
  subscribeToReactions: (handler: ReactionHandler) => () => void;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const PusherContext = createContext<PusherContextType | undefined>(undefined);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function PusherProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const { socketConfig } = useAppConfig();
  const [isConnected, setIsConnected] = useState(false);

  // ---------------------------------------------------------------------------
  // Connect/Disconnect based on auth state
  // Uses server-driven socket config from AppConfigContext when available.
  // Falls back to static PUSHER_CONFIG on first-ever launch before app-config loads.
  //
  // socketConfig is intentionally NOT in deps — we don't want to reconnect
  // when config refreshes mid-session. New config is picked up on next login.
  // On cold start, cached socketConfig loads from AsyncStorage before auth
  // completes, so it's available for the initial connection.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Connect to Pusher — pass server config (may be null on first launch)
      initializePusher(user.id, socketConfig ?? undefined).then(success => {
        setIsConnected(success);
      });
    } else {
      // Disconnect and clear handlers on logout
      disconnectPusher();
      clearHandlers();
      setIsConnected(false);
    }

    return () => {
      // Cleanup on unmount — disconnect but keep handlers
      // (they're managed by component lifecycle, not connection lifecycle)
      disconnectPusher();
    };
  }, [isAuthenticated, user?.id]);

  // ---------------------------------------------------------------------------
  // Ticker polling — keeps xprofile.last_activity fresh so the server
  // actually broadcasts Pusher events (it skips users inactive >5 min).
  // Same endpoint the web SPA polls every ~60s.
  // ---------------------------------------------------------------------------

  useTickerPolling(isAuthenticated && !!user?.id);

  // ---------------------------------------------------------------------------
  // Reconnect on app foreground
  // The server's 5-minute activity gate means backgrounded apps miss pushes.
  // ---------------------------------------------------------------------------

  useAppFocus(
    useCallback(() => {
      reconnectPusher().then(success => setIsConnected(success));
    }, []),
    isAuthenticated && !!user?.id,
  );

  // ---------------------------------------------------------------------------
  // Subscription methods
  // ---------------------------------------------------------------------------

  const subscribeToMessages = useCallback((handler: MessageHandler) => {
    return onNewMessage(handler);
  }, []);

  const subscribeToReactions = useCallback((handler: ReactionHandler) => {
    return onReaction(handler);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const value = useMemo(() => ({
    isConnected,
    subscribeToMessages,
    subscribeToReactions,
  }), [isConnected, subscribeToMessages, subscribeToReactions]);

  return (
    <PusherContext.Provider value={value}>
      {children}
    </PusherContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function usePusher() {
  const context = useContext(PusherContext);
  if (context === undefined) {
    throw new Error('usePusher must be used within a PusherProvider');
  }
  return context;
}

// -----------------------------------------------------------------------------
// Convenience Hooks
// -----------------------------------------------------------------------------

/**
 * Subscribe to new message events
 */
export function useNewMessageListener(handler: MessageHandler) {
  const { subscribeToMessages } = usePusher();
  const stableHandler = useEffectEvent(handler);

  useEffect(() => {
    const unsubscribe = subscribeToMessages(stableHandler);
    return unsubscribe;
  }, [subscribeToMessages]);
}

/**
 * Subscribe to reaction events
 */
export function useReactionListener(handler: ReactionHandler) {
  const { subscribeToReactions } = usePusher();
  const stableHandler = useEffectEvent(handler);

  useEffect(() => {
    const unsubscribe = subscribeToReactions(stableHandler);
    return unsubscribe;
  }, [subscribeToReactions]);
}

export default PusherContext;
