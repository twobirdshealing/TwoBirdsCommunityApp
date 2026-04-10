// =============================================================================
// PUSHER SERVICE - Real-time WebSocket connection for chat
// =============================================================================
// Handles Pusher connection, authentication, and channel subscriptions.
// Uses private channels that require authentication via WordPress.
// Server fires two events: 'message' (new chat message) and 'reaction'
// (emoji reaction toggled). Other updates (deletions, new threads) are
// handled by polling fallbacks in the message screens.
// =============================================================================

import { PUSHER_CONFIG } from '@/constants/config';
import { getAuthToken } from '@/services/auth';
import type { SocketConfig } from '@/services/api/appConfig';
import type { ChatMessage } from '@/types/message';
import Pusher from 'pusher-js/react-native';
import type { Channel } from 'pusher-js';
import { createLogger } from '@/utils/logger';

const log = createLogger('Pusher');

// Enable verbose Pusher logging in dev to see raw WebSocket traffic
if (__DEV__) {
  Pusher.logToConsole = true;
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PusherMessage {
  thread_id?: string | number;
  message: ChatMessage;
}

export interface PusherReaction {
  message_id: number;
  thread_id: string | number;
  reactions: Record<string, number[]>; // { emoji: [user_ids] }
}

export type MessageHandler = (data: PusherMessage) => void;
export type ReactionHandler = (data: PusherReaction) => void;

// -----------------------------------------------------------------------------
// Pusher Client Singleton
// -----------------------------------------------------------------------------

let pusherClient: Pusher | null = null;
let userChannel: Channel | null = null;
let currentUserId: number | null = null;
let currentSocketConfig: SocketConfig | undefined;
let connectedAt: number = 0;

// Event handlers registry
const messageHandlers: Set<MessageHandler> = new Set();
const reactionHandlers: Set<ReactionHandler> = new Set();

// Connection state callback — single consumer (PusherContext owns this)
let connectionStateCallback: ((connected: boolean) => void) | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export function setConnectionStateCallback(cb: ((connected: boolean) => void) | null): void {
  connectionStateCallback = cb;
}

// -----------------------------------------------------------------------------
// Initialize Pusher Connection
// -----------------------------------------------------------------------------

export async function initializePusher(userId: number, socketConfig: SocketConfig): Promise<boolean> {
  // Don't reinitialize if already connected for same user
  if (pusherClient && currentUserId === userId) {
    log.debug('Already connected for user', { userId });
    return true;
  }

  // Disconnect existing connection if different user
  if (pusherClient && currentUserId !== userId) {
    log.debug('Switching user, disconnecting...');
    disconnectPusher();
  }

  try {
    // Server-driven config — no fallback (if server returns socket: null, caller shouldn't call us)
    const appKey = socketConfig.api_key;
    const cluster = socketConfig.options?.cluster || 'mt1';
    const provider = socketConfig.options?.wsHost ? 'soketi' : 'pusher';

    log.info('Initializing Pusher', { userId, provider });

    // Get auth token for private channel authentication
    const token = await getAuthToken();
    if (!token) {
      log.debug('No auth token available');
      return false;
    }

    // Build Pusher options — add custom host params for Fluent Socket / Soketi
    const pusherOptions: any = {
      cluster,
      authorizer: (channel: { name: string }) => ({
        authorize: async (socketId: string, callback: (error: Error | null, data: any) => void) => {
          try {
            log.debug('Authorizing channel:', { name: channel.name });

            // Get fresh token each time (may have been refreshed since init)
            const freshToken = await getAuthToken();
            if (!freshToken) {
              callback(new Error('No auth token'), null);
              return;
            }

            const response = await fetch(PUSHER_CONFIG.AUTH_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${freshToken}`,
              },
              body: JSON.stringify({
                socket_id: socketId,
                channel_name: channel.name,
              }),
            });

            if (!response.ok) {
              const errorText = await response.text();
              log.debug('Auth failed:', { status: response.status, errorText });
              callback(new Error('Auth failed'), null);
              return;
            }

            const data = await response.json();
            log.debug('Auth successful:', { data });
            callback(null, data);
          } catch (error) {
            log.debug('Auth error:', { error });
            callback(error as Error, null);
          }
        },
      }),
    };

    // Fluent Socket / custom Soketi: add explicit WebSocket host options
    if (socketConfig?.options?.wsHost) {
      pusherOptions.wsHost = socketConfig.options.wsHost;
      pusherOptions.wsPort = socketConfig.options.wsPort ?? 443;
      pusherOptions.wssPort = socketConfig.options.wssPort ?? 443;
      pusherOptions.forceTLS = socketConfig.options.forceTLS ?? false;
      pusherOptions.enabledTransports = socketConfig.options.enabledTransports ?? ['ws', 'wss'];
    }

    // Create Pusher client
    pusherClient = new Pusher(appKey, pusherOptions);

    // Connection event handlers
    pusherClient.connection.bind('connected', () => {
      log.debug('Connected to Pusher, socket_id:', { socket_id: pusherClient?.connection.socket_id });
      connectedAt = Date.now();
      reconnectAttempts = 0;
      connectionStateCallback?.(true);
    });

    pusherClient.connection.bind('disconnected', () => {
      log.debug('Disconnected from Pusher');
      connectionStateCallback?.(false);
    });

    pusherClient.connection.bind('unavailable', () => {
      log.debug('Pusher connection unavailable');
      connectionStateCallback?.(false);
    });

    pusherClient.connection.bind('error', (error: any) => {
      log.debug('Connection error:', { error });
    });

    // Subscribe to user's private channel
    const channelName = `private-chat_user_${userId}`;
    log.debug('Subscribing to channel:', { channelName });

    userChannel = pusherClient.subscribe(channelName);

    userChannel.bind('pusher:subscription_succeeded', () => {
      log.debug('Successfully subscribed to', { channelName });
    });

    userChannel.bind('pusher:subscription_error', (error: any) => {
      log.debug('Subscription error:', { error });
      // Channel auth can fail after auto-reconnect (stale token) — force full reconnect
      // Exponential backoff with cap to prevent infinite loops on permanent auth failure
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        log.debug('Max reconnect attempts reached, giving up');
        return;
      }
      reconnectAttempts++;
      const delay = Math.min(5000 * Math.pow(2, reconnectAttempts - 1), 60_000);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        reconnectPusher();
      }, delay);
    });

    // Dev-only: catch ALL events on this channel for diagnostics
    if (__DEV__) {
      userChannel.bind_global((eventName: string, data: any) => {
        if (eventName !== 'message' && eventName !== 'reaction') {
          log.debug('Channel event', { eventName, dataPreview: JSON.stringify(data).slice(0, 200) });
        }
      });
    }

    // Bind to server-fired events
    userChannel.bind('message', (data: PusherMessage) => {
      log.debug('Received message, handlers:', { size: messageHandlers.size });
      messageHandlers.forEach(handler => handler(data));
    });

    userChannel.bind('reaction', (data: PusherReaction) => {
      log.debug('Received reaction, handlers:', { size: reactionHandlers.size });
      reactionHandlers.forEach(handler => handler(data));
    });

    currentUserId = userId;
    currentSocketConfig = socketConfig;
    return true;
  } catch (error) {
    log.debug('Initialize error:', { error });
    return false;
  }
}

// -----------------------------------------------------------------------------
// Disconnect Pusher
// -----------------------------------------------------------------------------

export function disconnectPusher(): void {
  log.debug('Disconnecting Pusher');

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  reconnectAttempts = 0;

  if (userChannel && currentUserId) {
    const channelName = `private-chat_user_${currentUserId}`;
    pusherClient?.unsubscribe(channelName);
    userChannel = null;
  }

  if (pusherClient) {
    pusherClient.disconnect();
    pusherClient = null;
  }

  currentUserId = null;
  currentSocketConfig = undefined;
  connectedAt = 0;
  // Don't clear handlers here — they're managed by React component lifecycle.
  // Only clearHandlers() on logout (called from PusherContext).
}

/**
 * Clear all event handlers. Call only on logout.
 */
export function clearHandlers(): void {
  messageHandlers.clear();
  reactionHandlers.clear();
  log.debug('Cleared all handlers');
}

// -----------------------------------------------------------------------------
// Reconnect Pusher (preserves existing event handlers)
// -----------------------------------------------------------------------------

export async function reconnectPusher(): Promise<boolean> {
  if (!currentUserId) {
    log.debug('Cannot reconnect - no current user');
    return false;
  }

  // Skip reconnect if already connected and connection is fresh
  const RECONNECT_COOLDOWN = 10_000;
  if (connectedAt && Date.now() - connectedAt < RECONNECT_COOLDOWN) {
    log.debug('Skipping reconnect — connection is fresh');
    return true;
  }

  // Skip full teardown if WebSocket is still alive (brief background)
  if (pusherClient?.connection.state === 'connected') {
    log.debug('Already connected — skipping reconnect');
    connectedAt = Date.now();
    return true;
  }

  const userId = currentUserId;
  const savedSocketConfig = currentSocketConfig;

  if (!savedSocketConfig) {
    log.debug('Cannot reconnect — no socket config');
    return false;
  }

  log.debug('Reconnecting Pusher for user', { userId });

  // Disconnect client and channel WITHOUT clearing handler Sets
  if (userChannel && currentUserId) {
    pusherClient?.unsubscribe(`private-chat_user_${currentUserId}`);
    userChannel = null;
  }

  if (pusherClient) {
    pusherClient.disconnect();
    pusherClient = null;
  }

  currentUserId = null;
  // DO NOT clear handlers — keep existing subscriptions

  return initializePusher(userId, savedSocketConfig);
}

// -----------------------------------------------------------------------------
// Event Subscription
// -----------------------------------------------------------------------------

export function onNewMessage(handler: MessageHandler): () => void {
  messageHandlers.add(handler);
  log.debug('Added message handler, total:', { size: messageHandlers.size });

  // Return unsubscribe function
  return () => {
    messageHandlers.delete(handler);
    log.debug('Removed message handler, total:', { size: messageHandlers.size });
  };
}

export function onReaction(handler: ReactionHandler): () => void {
  reactionHandlers.add(handler);
  return () => {
    reactionHandlers.delete(handler);
  };
}

// -----------------------------------------------------------------------------
// Connection State
// -----------------------------------------------------------------------------

export function isConnected(): boolean {
  return pusherClient?.connection.state === 'connected';
}

export function getConnectionState(): string {
  return pusherClient?.connection.state || 'disconnected';
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const pusherService = {
  initialize: initializePusher,
  disconnect: disconnectPusher,
  reconnect: reconnectPusher,
  clearHandlers,
  onNewMessage,
  onReaction,
  isConnected,
  getConnectionState,
};

export default pusherService;
