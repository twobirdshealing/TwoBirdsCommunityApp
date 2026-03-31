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
  setConnectionStateCallback,
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
  // Connection state callback — tracks real WebSocket state (connected/disconnected)
  // so isConnected reflects mid-foreground drops, not just init/resume transitions.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setConnectionStateCallback(setIsConnected);
    return () => setConnectionStateCallback(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Connect/Disconnect based on auth + server socket config
  // Only connects when the server provides socket config (socket !== null).
  // If server has no Pusher/Soketi configured, messaging still works via polling.
  // On first-ever launch, socketConfig arrives from the startup batch — the
  // effect re-fires when it does.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isAuthenticated && user?.id && socketConfig) {
      // Server provided socket config — connect
      initializePusher(user.id, socketConfig).then(success => {
        setIsConnected(success);
      });
    } else if (!isAuthenticated) {
      // Logout — disconnect and clear
      disconnectPusher();
      clearHandlers();
      setIsConnected(false);
    }

    return () => {
      disconnectPusher();
    };
  }, [isAuthenticated, user?.id, socketConfig]);

  // ---------------------------------------------------------------------------
  // Ticker polling — keeps xprofile.last_activity fresh so the server
  // actually broadcasts Pusher events (it skips users inactive >5 min).
  // Same endpoint the web SPA polls every ~60s.
  // Only active when socket is configured (no point polling without real-time).
  // ---------------------------------------------------------------------------

  useTickerPolling(isAuthenticated && !!user?.id && !!socketConfig);

  // ---------------------------------------------------------------------------
  // Reconnect on app foreground
  // The server's 5-minute activity gate means backgrounded apps miss pushes.
  // Only active when socket is configured.
  // ---------------------------------------------------------------------------

  useAppFocus(
    useCallback(() => {
      reconnectPusher().then(success => setIsConnected(success));
    }, []),
    isAuthenticated && !!user?.id && !!socketConfig,
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
