// =============================================================================
// PUSHER CONTEXT - Global real-time messaging state
// =============================================================================
// Manages Pusher connection lifecycle and provides event subscription hooks.
// Automatically connects when user is authenticated, disconnects on logout.
// Reconnects when app returns from background (v2.2.0).
// =============================================================================

import { useAuth } from '@/contexts/AuthContext';
import {
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
  useState,
} from 'react';
import { useAppFocus } from '@/hooks/useAppFocus';

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
  const [isConnected, setIsConnected] = useState(false);

  // ---------------------------------------------------------------------------
  // Connect/Disconnect based on auth state
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      // Connect to Pusher
      initializePusher(user.id).then(success => {
        setIsConnected(success);
      });
    } else {
      // Disconnect when logged out
      disconnectPusher();
      setIsConnected(false);
    }

    return () => {
      // Cleanup on unmount
      disconnectPusher();
    };
  }, [isAuthenticated, user?.id]);

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

  return (
    <PusherContext.Provider
      value={{
        isConnected,
        subscribeToMessages,
        subscribeToReactions,
      }}
    >
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
export function useNewMessageListener(
  handler: MessageHandler,
  deps: React.DependencyList = []
) {
  const { subscribeToMessages } = usePusher();

  useEffect(() => {
    const unsubscribe = subscribeToMessages(handler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeToMessages, ...deps]);
}

/**
 * Subscribe to reaction events
 */
export function useReactionListener(
  handler: ReactionHandler,
  deps: React.DependencyList = []
) {
  const { subscribeToReactions } = usePusher();

  useEffect(() => {
    const unsubscribe = subscribeToReactions(handler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeToReactions, ...deps]);
}

export default PusherContext;
