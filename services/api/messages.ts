// =============================================================================
// MESSAGES API - All chat/messaging-related API calls
// =============================================================================

import { ENDPOINTS } from '@/constants/config';
import {
  ChatMessage,
  CreateThreadRequest,
  CreateThreadResponse,
  MessagesResponse,
  SendMessageResponse,
  ThreadsResponse,
} from '@/types/message';
import { get, post } from './client';
import { createLogger } from '@/utils/logger';

const log = createLogger('MessagesAPI');

// -----------------------------------------------------------------------------
// Get All Threads (Conversations)
// -----------------------------------------------------------------------------

/**
 * Fetch the thread listing. Passing `search` filters server-side across all
 * thread types (DMs, groups, community/left-community) — the inbox uses this
 * for live search without paginating the full set client-side.
 */
export async function getThreads(params?: { search?: string }) {
  return get<ThreadsResponse>(ENDPOINTS.CHAT_THREADS, params);
}

// -----------------------------------------------------------------------------
// Get Threads with User Resolution (v2.2.0)
// -----------------------------------------------------------------------------
// Uses user_id query param to resolve an existing thread with a user.
// Returns selected_thread if a thread exists, intended_object if not.

export async function getThreadsForUser(userId: number) {
  return get<ThreadsResponse>(ENDPOINTS.CHAT_THREADS, { user_id: userId });
}

// -----------------------------------------------------------------------------
// Create New Thread (Start Conversation)
// -----------------------------------------------------------------------------

export async function createThread(data: CreateThreadRequest) {
  log.debug('createThread intent:', { intent_type: data.intent_type, intent_id: data.intent_id });
  return post<CreateThreadResponse>(ENDPOINTS.CHAT_THREADS, data);
}

// -----------------------------------------------------------------------------
// Get Messages in Thread (v2.2.0 — cursor-based pagination)
// -----------------------------------------------------------------------------
// First load: no beforeId → returns newest messages + threadDetails
// Older messages: pass beforeId (oldest message ID) to load earlier messages

export async function getMessages(threadId: number, beforeId?: number) {
  let url = ENDPOINTS.CHAT_MESSAGES(threadId);
  if (beforeId) {
    url += `?before_id=${beforeId}`;
  }
  return get<MessagesResponse>(url);
}

// -----------------------------------------------------------------------------
// Get New Messages (Polling)
// -----------------------------------------------------------------------------
// Use this to poll for new messages after a certain message ID

export async function getNewMessages(threadId: number, lastMessageId: number) {
  return get<{ messages: ChatMessage[] }>(
    ENDPOINTS.CHAT_MESSAGES_NEW(threadId, lastMessageId)
  );
}

// -----------------------------------------------------------------------------
// Send Message
// -----------------------------------------------------------------------------

export interface MessageAttachment {
  url: string;
  type: 'image';
  width?: number;
  height?: number;
}

export async function sendMessage(
  threadId: number,
  text: string,
  attachments?: MessageAttachment[],
  replyData?: { reply_to: number; reply_text: string }
) {
  log.debug('sendMessage', { threadId, attachmentCount: attachments?.length ?? 0 });
  // Build request matching native web app format
  const body: Record<string, any> = {
    text,
    reply_text: replyData?.reply_text || '',
  };

  if (replyData?.reply_to) {
    body.reply_to = replyData.reply_to;
  }

  // Add attachments as array of URL strings (native app format)
  if (attachments && attachments.length > 0) {
    body.mediaItems = attachments.map(a => a.url);
  }

  return post<SendMessageResponse>(ENDPOINTS.CHAT_MESSAGES(threadId), body);
}

// -----------------------------------------------------------------------------
// Start Chat with User (Convenience Function)
// -----------------------------------------------------------------------------
// Creates a new thread with initial message, or returns existing thread

export async function startChatWithUser(userId: number, initialMessage: string) {
  return createThread({
    message: initialMessage,
    intent_id: userId,
    intent_type: 'user',
  });
}

// -----------------------------------------------------------------------------
// Get Unread Thread IDs
// -----------------------------------------------------------------------------
// Returns array of thread IDs that have unread messages

export async function getUnreadThreadIds(): Promise<number[]> {
  const result = await get<{ unread_threads: Record<string, number> }>(
    ENDPOINTS.CHAT_UNREAD_THREADS
  );

  if (result.success && result.data.unread_threads) {
    return Object.keys(result.data.unread_threads).map(id => parseInt(id, 10));
  }

  return [];
}

// -----------------------------------------------------------------------------
// Get Unread Count
// -----------------------------------------------------------------------------
// Returns the number of threads with unread messages

export async function getMessageUnreadCount(): Promise<number> {
  const threadIds = await getUnreadThreadIds();
  return threadIds.length;
}

// -----------------------------------------------------------------------------
// Mark Threads as Read
// -----------------------------------------------------------------------------

export async function markThreadsRead(threadIds: number[]) {
  return post(ENDPOINTS.CHAT_MARK_READ, { thread_ids: threadIds });
}

// -----------------------------------------------------------------------------
// Delete Message
// -----------------------------------------------------------------------------
// Author-only — plugin checks user_id match server-side

export async function deleteMessage(messageId: number) {
  log.debug('deleteMessage:', { messageId });
  return post(ENDPOINTS.CHAT_MESSAGE_DELETE(messageId), {});
}

// -----------------------------------------------------------------------------
// Toggle Reaction (v2.2.0)
// -----------------------------------------------------------------------------

export async function toggleReaction(messageId: number, emoji: string) {
  return post(ENDPOINTS.CHAT_MESSAGE_REACT(messageId), { emoji });
}

// -----------------------------------------------------------------------------
// Delete Thread (v2.2.0 — DM threads only)
// -----------------------------------------------------------------------------

export async function deleteThread(threadId: number) {
  log.debug('deleteThread:', { threadId });
  return post(ENDPOINTS.CHAT_THREAD_DELETE(threadId), {});
}

// -----------------------------------------------------------------------------
// Get Single Thread (v2.2.0)
// -----------------------------------------------------------------------------

export async function getThread(threadId: number) {
  return get<{ thread: import('@/types/message').ChatThread }>(
    ENDPOINTS.CHAT_THREAD_BY_ID(threadId)
  );
}

// -----------------------------------------------------------------------------
// Block Thread (Chat-level block)
// -----------------------------------------------------------------------------

export async function blockThread(threadId: number) {
  log.debug('blockThread:', { threadId });
  return post(ENDPOINTS.CHAT_THREAD_BLOCK(threadId), {});
}

// -----------------------------------------------------------------------------
// Unblock Thread (Chat-level unblock)
// -----------------------------------------------------------------------------

export async function unblockThread(threadId: number) {
  log.debug('unblockThread:', { threadId });
  return post(ENDPOINTS.CHAT_THREAD_UNBLOCK(threadId), {});
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const messagesApi = {
  getThreads,
  getThreadsForUser,
  createThread,
  getMessages,
  getNewMessages,
  sendMessage,
  startChatWithUser,
  getUnreadThreadIds,
  getMessageUnreadCount,
  markThreadsRead,
  deleteMessage,
  toggleReaction,
  deleteThread,
  getThread,
  blockThread,
  unblockThread,
};

export default messagesApi;
