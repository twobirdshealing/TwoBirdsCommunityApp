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
import type { ChatMessage, ChatThread, ThreadInfo } from '@/types/message';
import type { XProfile } from '@/types/user';
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

// -----------------------------------------------------------------------------
// Group event payloads (Fluent Messaging 2.4.0+)
// -----------------------------------------------------------------------------
// All seven events fire on the existing private-chat_user_{user_id} channel —
// no new channel auth, no protocol changes. Server transforms the thread for
// the recipient so `info.is_admin` reflects the receiving user's perspective.

export interface PusherNewThread {
  thread: ChatThread;
}

export interface PusherThreadUpdated {
  thread_id?: number | string;
  thread?: ChatThread;
  info?: ThreadInfo;
}

export interface PusherGroupMemberAdded {
  thread_id: number | string;
  thread?: ChatThread;
  added: number[];           // user IDs that were added
  members?: XProfile[];      // optional — server may include hydrated profiles
}

export interface PusherGroupMemberRemoved {
  thread_id: number | string;
  thread?: ChatThread;
  user_id: number;
}

export interface PusherGroupAdminChanged {
  thread_id: number | string;
  thread?: ChatThread;
  user_id: number;
  is_admin: boolean;
}

export interface PusherGroupDeleted {
  thread_id: number | string;
}

export interface PusherGroupRemovedFrom {
  thread_id: number | string;
}

/**
 * Map of every server-fired Pusher event to its payload type. Adding a new
 * event = add a single line here, plus include the name in CHANNEL_BIND_EVENTS
 * (or USER_ONLY_EVENTS / SHARED_EVENTS) below.
 */
export interface PusherEventMap {
  message: PusherMessage;
  reaction: PusherReaction;
  new_thread: PusherNewThread;
  thread_updated: PusherThreadUpdated;
  group_member_added: PusherGroupMemberAdded;
  group_member_removed: PusherGroupMemberRemoved;
  group_admin_changed: PusherGroupAdminChanged;
  group_deleted: PusherGroupDeleted;
  group_removed_from: PusherGroupRemovedFrom;
}

export type PusherEventName = keyof PusherEventMap;
export type PusherEventHandler<K extends PusherEventName> = (data: PusherEventMap[K]) => void;

// Backwards-compat type aliases — let existing callers keep their named types.
export type MessageHandler = PusherEventHandler<'message'>;
export type ReactionHandler = PusherEventHandler<'reaction'>;
export type NewThreadHandler = PusherEventHandler<'new_thread'>;
export type ThreadUpdatedHandler = PusherEventHandler<'thread_updated'>;
export type GroupMemberAddedHandler = PusherEventHandler<'group_member_added'>;
export type GroupMemberRemovedHandler = PusherEventHandler<'group_member_removed'>;
export type GroupAdminChangedHandler = PusherEventHandler<'group_admin_changed'>;
export type GroupDeletedHandler = PusherEventHandler<'group_deleted'>;
export type GroupRemovedFromHandler = PusherEventHandler<'group_removed_from'>;

// -----------------------------------------------------------------------------
// Pusher Client Singleton
// -----------------------------------------------------------------------------

let pusherClient: Pusher | null = null;
let userChannel: Channel | null = null;
let currentUserId: number | null = null;
let currentSocketConfig: SocketConfig | undefined;
let connectedAt: number = 0;

// Active community-space channel subscriptions. Keyed by space_id so we can
// diff against the inbox's community_threads[] without reconnecting unchanged
// channels.
const spaceChannels = new Map<number, Channel>();
const desiredSpaceIds = new Set<number>();

// -----------------------------------------------------------------------------
// Event registry — one Set<Handler> per event, all owned by a typed Map
// -----------------------------------------------------------------------------

/**
 * Events bound on the user channel `private-chat_user_{user_id}`. Group events
 * (new_thread, thread_updated, etc.) only fire here — the server doesn't emit
 * them on space channels.
 */
const USER_CHANNEL_EVENTS: PusherEventName[] = [
  'message',
  'reaction',
  'new_thread',
  'thread_updated',
  'group_member_added',
  'group_member_removed',
  'group_admin_changed',
  'group_deleted',
  'group_removed_from',
];

/**
 * Events bound on community-space channels. The plugin only emits message +
 * reaction here; group events stay user-channel-only.
 */
const SPACE_CHANNEL_EVENTS: PusherEventName[] = ['message', 'reaction'];

/**
 * Single handler registry. `handlers[event]` returns a typed Set whose handler
 * signature matches the event's payload via the PusherEventMap.
 */
type AnyEventHandler = (data: any) => void;
const handlers: Record<PusherEventName, Set<AnyEventHandler>> = USER_CHANNEL_EVENTS.reduce(
  (acc, event) => {
    acc[event] = new Set();
    return acc;
  },
  {} as Record<PusherEventName, Set<AnyEventHandler>>,
);

function bindEvents(channel: Channel, events: PusherEventName[]): void {
  for (const event of events) {
    channel.bind(event, (data: any) => {
      handlers[event].forEach(h => h(data));
    });
  }
}

/**
 * Subscribe a typed handler to a Pusher event. Returns an unsubscribe function.
 * Prefer the per-event hooks in PusherContext (useNewMessageListener, etc.) at
 * call sites; this is the underlying primitive.
 */
export function subscribe<K extends PusherEventName>(
  event: K,
  handler: PusherEventHandler<K>,
): () => void {
  const set = handlers[event];
  set.add(handler as AnyEventHandler);
  return () => {
    set.delete(handler as AnyEventHandler);
  };
}

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

    // Dev-only: catch ALL events on this channel for diagnostics. Only logs
    // events we don't already have a typed handler for.
    if (__DEV__) {
      const known = new Set<string>(USER_CHANNEL_EVENTS);
      userChannel.bind_global((eventName: string, data: any) => {
        if (!known.has(eventName)) {
          log.debug('Channel event', { eventName, dataPreview: JSON.stringify(data).slice(0, 200) });
        }
      });
    }

    bindEvents(userChannel, USER_CHANNEL_EVENTS);

    currentUserId = userId;
    currentSocketConfig = socketConfig;

    // Re-subscribe to any community-space channels that were active before this
    // (re)connect. The inbox keeps `desiredSpaceIds` filled while it's open.
    for (const id of desiredSpaceIds) {
      subscribeToSpaceChannel(id);
    }

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

  tearDownSpaceChannels();

  if (pusherClient) {
    pusherClient.disconnect();
    pusherClient = null;
  }

  currentUserId = null;
  currentSocketConfig = undefined;
  connectedAt = 0;
  // Don't clear handlers here — they're managed by React component lifecycle.
  // Don't clear desiredSpaceIds either — reconnect needs it to re-subscribe.
  // clearHandlers() on logout (called from PusherContext) is what fully resets.
}

/**
 * Clear all event handlers. Call only on logout.
 */
export function clearHandlers(): void {
  for (const event of USER_CHANNEL_EVENTS) {
    handlers[event].clear();
  }
  desiredSpaceIds.clear();
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

  tearDownSpaceChannels();

  if (pusherClient) {
    pusherClient.disconnect();
    pusherClient = null;
  }

  currentUserId = null;
  // DO NOT clear handlers or desiredSpaceIds — initializePusher() resubscribes
  // to space channels using whatever's still in desiredSpaceIds.

  return initializePusher(userId, savedSocketConfig);
}

// -----------------------------------------------------------------------------
// Event Subscription — typed wrappers that just call subscribe(event, ...).
// Kept as named exports so call sites read fluently and code-search by event.
// -----------------------------------------------------------------------------

export const onNewMessage = (h: MessageHandler) => subscribe('message', h);
export const onReaction = (h: ReactionHandler) => subscribe('reaction', h);
export const onNewThread = (h: NewThreadHandler) => subscribe('new_thread', h);
export const onThreadUpdated = (h: ThreadUpdatedHandler) => subscribe('thread_updated', h);
export const onGroupMemberAdded = (h: GroupMemberAddedHandler) => subscribe('group_member_added', h);
export const onGroupMemberRemoved = (h: GroupMemberRemovedHandler) => subscribe('group_member_removed', h);
export const onGroupAdminChanged = (h: GroupAdminChangedHandler) => subscribe('group_admin_changed', h);
export const onGroupDeleted = (h: GroupDeletedHandler) => subscribe('group_deleted', h);
export const onGroupRemovedFrom = (h: GroupRemovedFromHandler) => subscribe('group_removed_from', h);

// -----------------------------------------------------------------------------
// Community-space channel subscriptions
// -----------------------------------------------------------------------------
// Community-space chats live on `private-chat_space_{space_id}` channels and
// fire the same `message` / `reaction` events as the user channel. The inbox
// drives the desired subscription set via `setSpaceChannelSubscriptions()`,
// which diffs against the live set so unchanged channels aren't churned.

function bindSpaceChannel(channel: Channel) {
  channel.bind('pusher:subscription_succeeded', () => {
    log.debug('Subscribed to space channel', { name: channel.name });
  });
  channel.bind('pusher:subscription_error', (error: any) => {
    log.debug('Space channel subscription error', { name: channel.name, error });
  });
  // Same handler Sets as the user channel — a `message` event from a space
  // chat reaches every useNewMessageListener subscriber.
  bindEvents(channel, SPACE_CHANNEL_EVENTS);
}

function subscribeToSpaceChannel(spaceId: number) {
  if (!pusherClient) return;
  if (spaceChannels.has(spaceId)) return;
  const name = `private-chat_space_${spaceId}`;
  log.debug('Subscribing to space channel', { name });
  const channel = pusherClient.subscribe(name);
  bindSpaceChannel(channel);
  spaceChannels.set(spaceId, channel);
}

function unsubscribeFromSpaceChannel(spaceId: number) {
  if (!pusherClient) return;
  const channel = spaceChannels.get(spaceId);
  if (!channel) return;
  pusherClient.unsubscribe(channel.name);
  spaceChannels.delete(spaceId);
}

/**
 * Drive the active community-space channel subscriptions from a list of space
 * IDs. Adds new subscriptions, removes stale ones, leaves untouched the rest.
 * Idempotent — call freely whenever the list changes; a no-op call (same set
 * of IDs as last time) does no work.
 */
export function setSpaceChannelSubscriptions(spaceIds: number[]): void {
  const next = new Set<number>();
  for (const id of spaceIds) {
    if (Number.isFinite(id) && id > 0) next.add(Number(id));
  }

  // Bail when the set is identical — common case: SWR/inbox revalidation that
  // produces a fresh array reference but the same space IDs.
  if (next.size === desiredSpaceIds.size) {
    let same = true;
    for (const id of next) if (!desiredSpaceIds.has(id)) { same = false; break; }
    if (same) return;
  }

  desiredSpaceIds.clear();
  for (const id of next) desiredSpaceIds.add(id);

  if (!pusherClient) return; // will sync on next initialize/reconnect

  for (const id of desiredSpaceIds) {
    if (!spaceChannels.has(id)) subscribeToSpaceChannel(id);
  }
  for (const id of Array.from(spaceChannels.keys())) {
    if (!desiredSpaceIds.has(id)) unsubscribeFromSpaceChannel(id);
  }
}

function tearDownSpaceChannels() {
  if (pusherClient) {
    for (const channel of spaceChannels.values()) {
      pusherClient.unsubscribe(channel.name);
    }
  }
  spaceChannels.clear();
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
  onNewThread,
  onThreadUpdated,
  onGroupMemberAdded,
  onGroupMemberRemoved,
  onGroupAdminChanged,
  onGroupDeleted,
  onGroupRemovedFrom,
  setSpaceChannelSubscriptions,
  isConnected,
  getConnectionState,
};

export default pusherService;
