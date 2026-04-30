// =============================================================================
// MESSAGE TYPES - TypeScript definitions for chat/messaging
// =============================================================================
// These types match the Fluent Community Chat v2.2.0 API response structure.
// =============================================================================

import { XProfile } from './user';

// -----------------------------------------------------------------------------
// Thread Info - Replaces xprofiles[] in v2.2.0 thread responses
// -----------------------------------------------------------------------------

export interface ThreadInfo {
  id: string | number;
  title: string;       // Display name (was display_name in XProfile)
  photo: string;       // Avatar URL (was avatar in XProfile)
  username: string;
  last_activity: string;
  permalink: string;
  type: string;
  badge: string | null;
  is_verified: number | boolean;

  // Group threads only (Fluent Messaging 2.4.0+)
  is_admin?: boolean;            // Current user is admin of this group
  admin_ids?: number[];          // All admin user IDs in this group
  can_view_members?: boolean;    // Current user is allowed to see members list
  can_send_message?: boolean;    // Current user is allowed to send messages
}

// -----------------------------------------------------------------------------
// Intended Object - User info when no thread exists yet
// -----------------------------------------------------------------------------

export interface IntendedObject {
  id: number;
  title: string;
  photo: string;
  type: string;
}

// -----------------------------------------------------------------------------
// Chat Thread - A conversation between users
// -----------------------------------------------------------------------------

export interface ChatThread {
  id: number;
  title: string;
  message_count: string | number;
  status: 'active' | 'inactive' | 'disabled';
  created_at: string;
  updated_at: string;

  // v2.2.0: Thread info (replaces xprofiles for the other participant)
  info?: ThreadInfo;
  type?: 'user' | 'community' | 'group';
  provider?: 'fcom' | 'group' | string;

  // Recent messages (preview — these do NOT have xprofile attached)
  messages: ChatMessage[];

  // Space ID if this is a community-space thread (different from group chat)
  space_id?: number | null;

  // Group threads only (Fluent Messaging 2.4.0+)
  total_members?: number;
  meta?: {
    created_by?: number;
    admin_ids?: number[];
    icon?: string;
  };
}

// -----------------------------------------------------------------------------
// Chat Message - Individual message in a thread
// -----------------------------------------------------------------------------

export interface ChatMessage {
  id: number;
  thread_id: string | number;
  user_id: string | number;
  text: string; // HTML content like <div class="chat_text"><p>...</p></div>
  created_at: string;
  updated_at?: string;

  // Sender profile (present on individual messages, NOT on thread preview messages)
  xprofile?: XProfile;

  // Message metadata (reactions, reply info, system events)
  meta?: {
    reactions?: Record<string, number[]>; // { emoji: [user_ids] }
    reply_to?: number;
    reply_text?: string;
    // Group system events ("Two Birds created the group", "X was added", etc.)
    // Server-emitted; render as a centered divider line in the chat stream.
    system_event?: boolean;
    system_text?: string;
  } | null;

  // Attachments (if any)
  attachments?: ChatAttachment[];
}

// -----------------------------------------------------------------------------
// Chat Attachment - Media attached to a message
// -----------------------------------------------------------------------------

export interface ChatAttachment {
  id: number;
  type: 'image' | 'video' | 'file';
  url: string;
  thumbnail?: string;
  filename?: string;
  size?: number;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export interface ThreadsResponse {
  community_threads: ChatThread[];
  left_community_threads: ChatThread[];
  threads: ChatThread[];
  group_threads?: ChatThread[];   // Fluent Messaging 2.4.0+
  has_more_threads: boolean;
  selected_thread?: ChatThread;
  intended_object?: IntendedObject;
}

export interface ThreadResponse {
  thread: ChatThread;
}

// v2.2.0: Thread details returned with messages (same shape as thread)
export interface ThreadDetails {
  id: number;
  title: string;
  space_id?: number | null;
  message_count?: string | number;
  status?: string;
  provider?: 'fcom' | 'group' | string;
  type?: 'user' | 'community' | 'group';
  info?: ThreadInfo;
  blocked_thread?: boolean;
  total_members?: number;
  meta?: {
    created_by?: number;
    admin_ids?: number[];
    icon?: string;
  };
}

// v2.2.0: Messages are a flat array with cursor-based pagination
export interface MessagesResponse {
  messages: ChatMessage[];
  has_more: boolean;
  threadDetails?: ThreadDetails;
}

export interface SendMessageResponse {
  message: ChatMessage;
}

export interface CreateThreadResponse {
  thread: ChatThread;
  message?: ChatMessage;
}

// -----------------------------------------------------------------------------
// Request Types
// -----------------------------------------------------------------------------

export interface CreateThreadRequest {
  message: string;
  intent_id: number; // User ID to start chat with
  intent_type: 'user'; // Type of intent
}

export interface SendMessageRequest {
  text: string;
}

// -----------------------------------------------------------------------------
// Group Thread Request / Response Types (Fluent Messaging 2.4.0+)
// -----------------------------------------------------------------------------

export interface CreateGroupRequest {
  title: string;
  member_ids: number[];        // Initial members (excluding the creator)
  icon?: string;               // Optional icon URL — mobile doesn't expose a picker yet
}

export interface UpdateGroupRequest {
  title?: string;
  icon?: string;
}

export interface AddGroupMembersRequest {
  member_ids: number[];
}

export interface SetGroupAdminRequest {
  is_admin: boolean;
}

export interface CreateGroupResponse {
  thread: ChatThread;
  is_new: boolean;
}

export interface GroupMutationResponse {
  success: boolean;
  thread?: ChatThread;
  added?: number[];            // present on add-members
}

/**
 * Group member as returned by /chat/groups/{id}/members.
 * Server adds `is_group_admin` onto each xprofile entry.
 */
export interface GroupMember extends XProfile {
  is_group_admin?: boolean;
}

/**
 * Paginated members response — matches Laravel paginator shape used elsewhere.
 */
export interface GroupMembersResponse {
  members: {
    data: GroupMember[];
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
    from: number | null;
    to: number | null;
  };
  admin_ids: number[];
}

// -----------------------------------------------------------------------------
// Group Helpers
// -----------------------------------------------------------------------------

/**
 * Canonical "is this a group thread?" check.
 * `provider === 'group'` is the discriminator. `type` is also set by the server
 * but we standardize on `provider` so the same predicate works on threads,
 * messages payloads, and push notification payloads.
 */
export function isGroupThread(thread: { provider?: string; type?: string } | null | undefined): boolean {
  if (!thread) return false;
  return thread.provider === 'group' || thread.type === 'group';
}

/**
 * Whether the current user can perform admin actions on this group.
 * Buttons / context-menu items the user lacks permission for don't render;
 * server still rejects with 403 if a stale UI state lets one through.
 */
export function isGroupAdmin(thread: ChatThread | ThreadDetails | null | undefined): boolean {
  return Boolean(thread?.info?.is_admin);
}

/**
 * Total member count for a group thread (0 for non-groups).
 */
export function getGroupMemberCount(thread: ChatThread | ThreadDetails | null | undefined): number {
  if (!isGroupThread(thread ?? undefined)) return 0;
  return Number(thread?.total_members ?? 0);
}

/**
 * Canonical "is this a community-space thread?" check.
 * Community-space threads have `space_id` set (the chat lives inside a Space).
 * Group threads have `provider === 'group'` and no space_id; DMs have neither.
 */
export function isSpaceThread(
  thread: { space_id?: number | null; provider?: string; type?: string } | null | undefined,
): boolean {
  if (!thread) return false;
  if (isGroupThread(thread)) return false;
  return Boolean(thread.space_id);
}

// -----------------------------------------------------------------------------
// Transform Functions
// -----------------------------------------------------------------------------

/**
 * Strip HTML from message text for preview
 */
export function getMessagePreview(text: string, maxLength = 50): string {
  // Remove HTML tags
  const stripped = text
    .replace(/<div class="chat_text">/g, '')
    .replace(/<\/div>/g, '')
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '')
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]*>/g, '')
    .trim();

  // Truncate if needed
  if (stripped.length > maxLength) {
    return stripped.substring(0, maxLength) + '...';
  }

  return stripped;
}

/**
 * Get plain text from HTML message
 */
export function getMessageText(text: string): string {
  return text
    .replace(/<div class="chat_text">/g, '')
    .replace(/<\/div>/g, '')
    .replace(/<p>/g, '')
    .replace(/<\/p>/g, '\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}

/**
 * Get thread display name from info field (v2.2.0)
 */
export function getThreadDisplayName(thread: ChatThread): string {
  return thread.info?.title || thread.title || 'Unknown';
}

/**
 * Get thread avatar URL from info field (v2.2.0)
 */
export function getThreadAvatar(thread: ChatThread): string | null {
  return thread.info?.photo || null;
}

/**
 * Get thread user ID from info field (v2.2.0)
 */
export function getThreadUserId(thread: ChatThread): number | null {
  if (thread.info?.id) {
    return Number(thread.info.id);
  }
  return null;
}

/**
 * Get thread username from info field (v2.2.0)
 */
export function getThreadUsername(thread: ChatThread): string | null {
  return thread.info?.username || null;
}

/**
 * Check if thread participant is verified (v2.2.0)
 */
export function isThreadVerified(thread: ChatThread): boolean {
  if (!thread.info) return false;
  return thread.info.is_verified === 1 || thread.info.is_verified === true;
}

/**
 * Get thread participant's badge slugs (v2.2.0)
 * ThreadInfo.badge is a single string; convert to array for useProfileBadges.
 */
export function getThreadBadgeSlugs(thread: ChatThread): string[] {
  if (!thread.info?.badge) return [];
  return [thread.info.badge];
}

/**
 * Get last message in thread for preview
 */
export function getLastMessage(thread: ChatThread): ChatMessage | null {
  if (!thread.messages || thread.messages.length === 0) {
    return null;
  }

  return thread.messages[thread.messages.length - 1];
}

