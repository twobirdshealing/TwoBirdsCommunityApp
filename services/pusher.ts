// =============================================================================
// PUSHER SERVICE - Real-time WebSocket connection for chat
// =============================================================================
// Handles Pusher connection, authentication, and channel subscriptions.
// Uses private channels that require authentication via WordPress.
// Updated for Fluent Messaging v2.2.0 event names and new events.
// =============================================================================

import { PUSHER_CONFIG } from '@/constants/config';
import { getAuthToken } from '@/services/auth';
import Pusher, { Channel } from 'pusher-js';

// -----------------------------------------------------------------------------
// Debug
// -----------------------------------------------------------------------------

const DEBUG = __DEV__;
function log(...args: any[]) {
  if (DEBUG) console.log('[Pusher]', ...args);
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PusherMessage {
  thread_id?: string | number; // v2.2.0: thread_id at top level
  message: {
    id: number;
    thread_id: string | number;
    user_id: string | number;
    text: string;
    created_at: string;
    xprofile: any;
  };
}

export interface PusherThread {
  thread: {
    id: number;
    title: string;
    status: string;
    info?: any;
    messages: any[];
  };
}

export interface PusherReaction {
  message_id: number;
  thread_id: string | number;
  reactions: Record<string, number[]>; // { emoji: [user_ids] }
}

export interface PusherMessageDeleted {
  thread_id: string | number;
  message_id: number;
}

export interface PusherThreadUpdated {
  thread: any;
}

export type MessageHandler = (data: PusherMessage) => void;
export type ThreadHandler = (data: PusherThread) => void;
export type ReactionHandler = (data: PusherReaction) => void;
export type MessageDeletedHandler = (data: PusherMessageDeleted) => void;
export type ThreadUpdatedHandler = (data: PusherThreadUpdated) => void;

// -----------------------------------------------------------------------------
// Pusher Client Singleton
// -----------------------------------------------------------------------------

let pusherClient: Pusher | null = null;
let userChannel: Channel | null = null;
let currentUserId: number | null = null;

// Event handlers registry
const messageHandlers: Set<MessageHandler> = new Set();
const threadHandlers: Set<ThreadHandler> = new Set();
const reactionHandlers: Set<ReactionHandler> = new Set();
const messageDeletedHandlers: Set<MessageDeletedHandler> = new Set();
const threadUpdatedHandlers: Set<ThreadUpdatedHandler> = new Set();

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
      log('Connected to Pusher');
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

    // v2.2.0: Bind both 'message' (new) and 'new_message' (legacy) for compat
    userChannel.bind('message', (data: PusherMessage) => {
      log('Received message:', data);
      messageHandlers.forEach(handler => handler(data));
    });

    userChannel.bind('new_message', (data: PusherMessage) => {
      log('Received new_message:', data);
      messageHandlers.forEach(handler => handler(data));
    });

    userChannel.bind('new_thread', (data: PusherThread) => {
      log('Received new_thread:', data);
      threadHandlers.forEach(handler => handler(data));
    });

    // v2.2.0: New events
    userChannel.bind('reaction', (data: PusherReaction) => {
      log('Received reaction:', data);
      reactionHandlers.forEach(handler => handler(data));
    });

    userChannel.bind('message_deleted', (data: PusherMessageDeleted) => {
      log('Received message_deleted:', data);
      messageDeletedHandlers.forEach(handler => handler(data));
    });

    userChannel.bind('thread_updated', (data: PusherThreadUpdated) => {
      log('Received thread_updated:', data);
      threadUpdatedHandlers.forEach(handler => handler(data));
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
  messageHandlers.clear();
  threadHandlers.clear();
  reactionHandlers.clear();
  messageDeletedHandlers.clear();
  threadUpdatedHandlers.clear();
}

// -----------------------------------------------------------------------------
// Reconnect Pusher (preserves existing event handlers)
// -----------------------------------------------------------------------------

export async function reconnectPusher(): Promise<boolean> {
  if (!currentUserId) {
    log('Cannot reconnect - no current user');
    return false;
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

export function onNewThread(handler: ThreadHandler): () => void {
  threadHandlers.add(handler);
  log('Added thread handler, total:', threadHandlers.size);

  // Return unsubscribe function
  return () => {
    threadHandlers.delete(handler);
    log('Removed thread handler, total:', threadHandlers.size);
  };
}

export function onReaction(handler: ReactionHandler): () => void {
  reactionHandlers.add(handler);
  return () => {
    reactionHandlers.delete(handler);
  };
}

export function onMessageDeleted(handler: MessageDeletedHandler): () => void {
  messageDeletedHandlers.add(handler);
  return () => {
    messageDeletedHandlers.delete(handler);
  };
}

export function onThreadUpdated(handler: ThreadUpdatedHandler): () => void {
  threadUpdatedHandlers.add(handler);
  return () => {
    threadUpdatedHandlers.delete(handler);
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
  onNewMessage,
  onNewThread,
  onReaction,
  onMessageDeleted,
  onThreadUpdated,
  isConnected,
  getConnectionState,
};

export default pusherService;
