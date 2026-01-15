// =============================================================================
// PUSHER CONTEXT - Global real-time messaging state
// =============================================================================
// Manages Pusher connection lifecycle and provides event subscription hooks.
// Automatically connects when user is authenticated, disconnects on logout.
// =============================================================================

import { useAuth } from '@/contexts/AuthContext';
import {
  disconnectPusher,
  initializePusher,
  MessageHandler,
  onNewMessage,
  onNewThread,
  PusherMessage,
  PusherThread,
  ThreadHandler,
} from '@/services/pusher';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PusherContextType {
  isConnected: boolean;
  subscribeToMessages: (handler: MessageHandler) => () => void;
  subscribeToThreads: (handler: ThreadHandler) => () => void;
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
  // Subscription methods
  // ---------------------------------------------------------------------------

  const subscribeToMessages = useCallback((handler: MessageHandler) => {
    return onNewMessage(handler);
  }, []);

  const subscribeToThreads = useCallback((handler: ThreadHandler) => {
    return onNewThread(handler);
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
 * Usage:
 *   useNewMessageListener((data) => {
 *     console.log('New message:', data.message);
 *   });
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
 * Usage:
 *   useNewThreadListener((data) => {
 *     console.log('New thread:', data.thread);
 *   });
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

export default PusherContext;
