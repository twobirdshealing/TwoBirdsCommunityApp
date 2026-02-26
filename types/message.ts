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
  type?: 'user' | 'community';
  provider?: string;

  // Recent messages (preview — these do NOT have xprofile attached)
  messages: ChatMessage[];

  // Space ID if this is a group chat
  space_id?: number | null;
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

  // Message metadata (reactions, reply info)
  meta?: {
    reactions?: Record<string, number[]>; // { emoji: [user_ids] }
    reply_to?: number;
    reply_text?: string;
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
  provider?: string;
  type?: 'user' | 'community';
  info?: ThreadInfo;
  blocked_thread?: boolean;
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

