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
  onNewThread,
  onReaction,
  onMessageDeleted,
  onThreadUpdated,
  PusherMessage,
  PusherThread,
  PusherReaction,
  PusherMessageDeleted,
  PusherThreadUpdated,
  ThreadHandler,
  ReactionHandler,
  MessageDeletedHandler,
  ThreadUpdatedHandler,
} from '@/services/pusher';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PusherContextType {
  isConnected: boolean;
  subscribeToMessages: (handler: MessageHandler) => () => void;
  subscribeToThreads: (handler: ThreadHandler) => () => void;
  subscribeToReactions: (handler: ReactionHandler) => () => void;
  subscribeToMessageDeleted: (handler: MessageDeletedHandler) => () => void;
  subscribeToThreadUpdated: (handler: ThreadUpdatedHandler) => () => void;
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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

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
  // Reconnect on app foreground (v2.2.0)
  // The server's 5-minute activity gate means backgrounded apps miss pushes.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isAuthenticated &&
        user?.id
      ) {
        reconnectPusher().then(success => {
          setIsConnected(success);
        });
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isAuthenticated, user?.id]);

  // ---------------------------------------------------------------------------
  // Subscription methods
  // ---------------------------------------------------------------------------

  const subscribeToMessages = useCallback((handler: MessageHandler) => {
    return onNewMessage(handler);
  }, []);

  const subscribeToThreads = useCallback((handler: ThreadHandler) => {
    return onNewThread(handler);
  }, []);

  const subscribeToReactions = useCallback((handler: ReactionHandler) => {
    return onReaction(handler);
  }, []);

  const subscribeToMessageDeleted = useCallback((handler: MessageDeletedHandler) => {
    return onMessageDeleted(handler);
  }, []);

  const subscribeToThreadUpdated = useCallback((handler: ThreadUpdatedHandler) => {
    return onThreadUpdated(handler);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <PusherContext.Provider
      value={{
        isConnected,
        subscribeToMessages,
        subscribeToThreads,
        subscribeToReactions,
        subscribeToMessageDeleted,
        subscribeToThreadUpdated,
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
 * Subscribe to new message events (both 'message' and 'new_message')
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
 * Subscribe to new thread events
 */
export function useNewThreadListener(
  handler: ThreadHandler,
  deps: React.DependencyList = []
) {
  const { subscribeToThreads } = usePusher();

  useEffect(() => {
    const unsubscribe = subscribeToThreads(handler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeToThreads, ...deps]);
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

/**
 * Subscribe to message deleted events
 */
export function useMessageDeletedListener(
  handler: MessageDeletedHandler,
  deps: React.DependencyList = []
) {
  const { subscribeToMessageDeleted } = usePusher();

  useEffect(() => {
    const unsubscribe = subscribeToMessageDeleted(handler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeToMessageDeleted, ...deps]);
}

/**
 * Subscribe to thread updated events
 */
export function useThreadUpdatedListener(
  handler: ThreadUpdatedHandler,
  deps: React.DependencyList = []
) {
  const { subscribeToThreadUpdated } = usePusher();

  useEffect(() => {
    const unsubscribe = subscribeToThreadUpdated(handler);
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribeToThreadUpdated, ...deps]);
}

export default PusherContext;
