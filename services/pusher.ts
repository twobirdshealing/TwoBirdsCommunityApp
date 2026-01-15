// =============================================================================
// PUSHER SERVICE - Real-time WebSocket connection for chat
// =============================================================================
// Handles Pusher connection, authentication, and channel subscriptions.
// Uses private channels that require authentication via WordPress.
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
    xprofiles: any[];
    messages: any[];
  };
}

export type MessageHandler = (data: PusherMessage) => void;
export type ThreadHandler = (data: PusherThread) => void;

// -----------------------------------------------------------------------------
// Pusher Client Singleton
// -----------------------------------------------------------------------------

let pusherClient: Pusher | null = null;
let userChannel: Channel | null = null;
let currentUserId: number | null = null;

// Event handlers registry
const messageHandlers: Set<MessageHandler> = new Set();
const threadHandlers: Set<ThreadHandler> = new Set();

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

            const response = await fetch(PUSHER_CONFIG.AUTH_ENDPOINT, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
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

    // Bind event handlers
    userChannel.bind('new_message', (data: PusherMessage) => {
      log('Received new_message:', data);
      messageHandlers.forEach(handler => handler(data));
    });

    userChannel.bind('new_thread', (data: PusherThread) => {
      log('Received new_thread:', data);
      threadHandlers.forEach(handler => handler(data));
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
  onNewMessage,
  onNewThread,
  isConnected,
  getConnectionState,
};

export default pusherService;
