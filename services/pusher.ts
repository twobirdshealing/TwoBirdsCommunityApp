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
let connectedAt: number = 0;

// Event handlers registry
const messageHandlers: Set<MessageHandler> = new Set();
const reactionHandlers: Set<ReactionHandler> = new Set();

// -----------------------------------------------------------------------------
// Initialize Pusher Connection
// -----------------------------------------------------------------------------

export async function initializePusher(userId: number): Promise<boolean> {
  // Don't reinitialize if already connected for same user
  if (pusherClient && currentUserId === userId) {
    log('Already connected for user', userId);
    return true;
  }

  // Disconnect existing connection if different user
  if (pusherClient && currentUserId !== userId) {
    log('Switching user, disconnecting...');
    disconnectPusher();
  }

  try {
    log('Initializing Pusher for user', userId);

    // Get auth token for private channel authentication
    const token = await getAuthToken();
    if (!token) {
      log('No auth token available');
      return false;
    }

    // Create Pusher client with custom authorizer
    pusherClient = new Pusher(PUSHER_CONFIG.APP_KEY, {
      cluster: PUSHER_CONFIG.CLUSTER,
      authorizer: (channel) => ({
        authorize: async (socketId, callback) => {
          try {
            log('Authorizing channel:', channel.name);

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
              log('Auth failed:', response.status, errorText);
              callback(new Error('Auth failed'), null);
              return;
            }

            const data = await response.json();
            log('Auth successful:', data);
            callback(null, data);
          } catch (error) {
            log('Auth error:', error);
            callback(error as Error, null);
          }
        },
      }),
    });

    // Connection event handlers
    pusherClient.connection.bind('connected', () => {
      log('Connected to Pusher, socket_id:', pusherClient?.connection.socket_id);
      connectedAt = Date.now();
    });

    pusherClient.connection.bind('disconnected', () => {
      log('Disconnected from Pusher');
    });

    pusherClient.connection.bind('error', (error: any) => {
      log('Connection error:', error);
    });

    // Subscribe to user's private channel
    const channelName = `private-chat_user_${userId}`;
    log('Subscribing to channel:', channelName);

    userChannel = pusherClient.subscribe(channelName);

    userChannel.bind('pusher:subscription_succeeded', () => {
      log('Successfully subscribed to', channelName);
    });

    userChannel.bind('pusher:subscription_error', (error: any) => {
      log('Subscription error:', error);
    });

    // Dev-only: catch ALL events on this channel for diagnostics
    if (__DEV__) {
      userChannel.bind_global((eventName: string, data: any) => {
        if (eventName !== 'message' && eventName !== 'reaction') {
          log('Channel event:', eventName, '| data:', JSON.stringify(data).slice(0, 200));
        }
      });
    }

    // Bind to server-fired events
    userChannel.bind('message', (data: PusherMessage) => {
      log('Received message, handlers:', messageHandlers.size);
      messageHandlers.forEach(handler => handler(data));
    });

    userChannel.bind('reaction', (data: PusherReaction) => {
      log('Received reaction, handlers:', reactionHandlers.size);
      reactionHandlers.forEach(handler => handler(data));
    });

    currentUserId = userId;
    return true;
  } catch (error) {
    log('Initialize error:', error);
    return false;
  }
}

// -----------------------------------------------------------------------------
// Disconnect Pusher
// -----------------------------------------------------------------------------

export function disconnectPusher(): void {
  log('Disconnecting Pusher');

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
  log('Cleared all handlers');
}

// -----------------------------------------------------------------------------
// Reconnect Pusher (preserves existing event handlers)
// -----------------------------------------------------------------------------

export async function reconnectPusher(): Promise<boolean> {
  if (!currentUserId) {
    log('Cannot reconnect - no current user');
    return false;
  }

  // Skip reconnect if already connected and connection is fresh
  const RECONNECT_COOLDOWN = 10_000;
  if (connectedAt && Date.now() - connectedAt < RECONNECT_COOLDOWN) {
    log('Skipping reconnect — connection is fresh');
    return true;
  }

  // Skip full teardown if WebSocket is still alive (brief background)
  if (pusherClient?.connection.state === 'connected') {
    log('Already connected — skipping reconnect');
    connectedAt = Date.now();
    return true;
  }

  const userId = currentUserId;
  log('Reconnecting Pusher for user', userId);

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

  return initializePusher(userId);
}

// -----------------------------------------------------------------------------
// Event Subscription
// -----------------------------------------------------------------------------

export function onNewMessage(handler: MessageHandler): () => void {
  messageHandlers.add(handler);
  log('Added message handler, total:', messageHandlers.size);

  // Return unsubscribe function
  return () => {
    messageHandlers.delete(handler);
    log('Removed message handler, total:', messageHandlers.size);
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
