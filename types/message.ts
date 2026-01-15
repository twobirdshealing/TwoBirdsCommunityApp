// =============================================================================
// MESSAGE TYPES - TypeScript definitions for chat/messaging
// =============================================================================
// These types match the Fluent Community Chat API response structure.
// =============================================================================

import { XProfile } from './user';

// -----------------------------------------------------------------------------
// Chat Thread - A conversation between users
// -----------------------------------------------------------------------------

export interface ChatThread {
  id: number;
  title: string;
  message_count: string | number;
  status: 'active' | 'archived';
  created_at: string;
  updated_at: string;

  // Participants in the thread
  xprofiles: XProfile[];

  // Recent messages (usually last few for preview)
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

  // Sender profile
  xprofile: XProfile;

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
  threads: ChatThread[];
}

export interface ThreadResponse {
  thread: ChatThread;
}

// Paginated response from Laravel
export interface PaginatedMessages {
  current_page: number;
  data: ChatMessage[];
  last_page: number;
  per_page: number;
  total: number;
}

export interface MessagesResponse {
  messages: PaginatedMessages;
  thread?: ChatThread;
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
 * Get the other participant(s) in a thread (excluding current user)
 */
export function getOtherParticipants(thread: ChatThread, currentUserId: number): XProfile[] {
  // Use Number() to handle string/number type mismatch from API
  return thread.xprofiles.filter(p => Number(p.user_id) !== currentUserId);
}

/**
 * Get thread display name (other participant's name for DMs)
 */
export function getThreadDisplayName(thread: ChatThread, currentUserId: number): string {
  const others = getOtherParticipants(thread, currentUserId);

  if (others.length === 0) {
    return 'Unknown';
  }

  if (others.length === 1) {
    return others[0].display_name;
  }

  // Group chat - show first few names
  const names = others.slice(0, 3).map(p => p.display_name);
  if (others.length > 3) {
    return names.join(', ') + ` +${others.length - 3}`;
  }

  return names.join(', ');
}

/**
 * Get thread avatar (other participant's avatar for DMs)
 */
export function getThreadAvatar(thread: ChatThread, currentUserId: number): string | null {
  const others = getOtherParticipants(thread, currentUserId);

  if (others.length === 0) {
    return null;
  }

  return others[0].avatar;
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
