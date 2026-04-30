// =============================================================================
// PUSHER CONTEXT - Global real-time messaging state
// =============================================================================
// Manages Pusher connection lifecycle and exposes typed listener hooks for
// every server-fired event. Connection state lives in context (`isConnected`);
// event subscriptions go through the singleton handler registry in
// services/pusher.ts via the typed `subscribe(event, handler)` primitive.
// =============================================================================

import { useAppConfig } from '@/contexts/AppConfigContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearHandlers,
  disconnectPusher,
  initializePusher,
  reconnectPusher,
  setConnectionStateCallback,
  subscribe,
  type PusherEventName,
  type PusherEventHandler,
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
// Context — exposes only connection state. Event subscriptions are independent
// of context and go through the registry directly via `useChannelEvent`.
// -----------------------------------------------------------------------------

interface PusherContextType {
  isConnected: boolean;
}

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
      initializePusher(user.id, socketConfig).then(success => {
        setIsConnected(success);
      });
    } else if (!isAuthenticated) {
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
  // ---------------------------------------------------------------------------

  useTickerPolling(isAuthenticated && !!user?.id && !!socketConfig);

  // ---------------------------------------------------------------------------
  // Reconnect on app foreground
  // The server's 5-minute activity gate means backgrounded apps miss pushes.
  // ---------------------------------------------------------------------------

  useAppFocus(
    useCallback(() => {
      reconnectPusher().then(success => setIsConnected(success));
    }, []),
    isAuthenticated && !!user?.id && !!socketConfig,
  );

  const value = useMemo(() => ({ isConnected }), [isConnected]);

  return <PusherContext.Provider value={value}>{children}</PusherContext.Provider>;
}

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

export function usePusher() {
  const context = useContext(PusherContext);
  if (context === undefined) {
    throw new Error('usePusher must be used within a PusherProvider');
  }
  return context;
}

/**
 * Subscribe a component to a typed Pusher event for the lifetime of its mount.
 * Handler identity doesn't matter — `useEffectEvent` keeps the latest closure
 * stable across renders without re-binding the subscription.
 *
 * Most callers should use the named per-event hooks below for readability;
 * `useChannelEvent` is the underlying primitive when you need a generic.
 */
export function useChannelEvent<K extends PusherEventName>(
  event: K,
  handler: PusherEventHandler<K>,
) {
  const stableHandler = useEffectEvent(handler);
  useEffect(() => subscribe(event, stableHandler), [event]);
}

// -----------------------------------------------------------------------------
// Named convenience hooks — one-liners over useChannelEvent. They exist so
// call sites read fluently and grep-by-event finds them.
// -----------------------------------------------------------------------------

export const useNewMessageListener = (h: PusherEventHandler<'message'>) => useChannelEvent('message', h);
export const useReactionListener = (h: PusherEventHandler<'reaction'>) => useChannelEvent('reaction', h);
export const useNewThreadListener = (h: PusherEventHandler<'new_thread'>) => useChannelEvent('new_thread', h);
export const useThreadUpdatedListener = (h: PusherEventHandler<'thread_updated'>) => useChannelEvent('thread_updated', h);
export const useGroupMemberAddedListener = (h: PusherEventHandler<'group_member_added'>) => useChannelEvent('group_member_added', h);
export const useGroupMemberRemovedListener = (h: PusherEventHandler<'group_member_removed'>) => useChannelEvent('group_member_removed', h);
export const useGroupAdminChangedListener = (h: PusherEventHandler<'group_admin_changed'>) => useChannelEvent('group_admin_changed', h);
export const useGroupDeletedListener = (h: PusherEventHandler<'group_deleted'>) => useChannelEvent('group_deleted', h);
export const useGroupRemovedFromListener = (h: PusherEventHandler<'group_removed_from'>) => useChannelEvent('group_removed_from', h);

export default PusherContext;
