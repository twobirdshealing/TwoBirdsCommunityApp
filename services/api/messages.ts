// =============================================================================
// MESSAGES API - All chat/messaging-related API calls
// =============================================================================

import { ENDPOINTS } from '@/constants/config';
import {
  ChatMessage,
  ChatThread,
  CreateThreadRequest,
  CreateThreadResponse,
  MessagesResponse,
  SendMessageRequest,
  SendMessageResponse,
  ThreadsResponse,
} from '@/types/message';
import { get, post } from './client';

// -----------------------------------------------------------------------------
// Get All Threads (Conversations)
// -----------------------------------------------------------------------------

export async function getThreads() {
  const result = await get<ThreadsResponse>(ENDPOINTS.CHAT_THREADS);

  if (result.success) {
    return {
      success: true as const,
      data: result.data,
    };
  }

  return result;
}

// -----------------------------------------------------------------------------
// Create New Thread (Start Conversation)
// -----------------------------------------------------------------------------

export async function createThread(request: CreateThreadRequest) {
  const result = await post<CreateThreadResponse>(ENDPOINTS.CHAT_THREADS, request);

  if (result.success) {
    return {
      success: true as const,
      data: result.data,
    };
  }

  return result;
}

// -----------------------------------------------------------------------------
// Get Messages in Thread
// -----------------------------------------------------------------------------

export async function getMessages(threadId: number) {
  const result = await get<MessagesResponse>(ENDPOINTS.CHAT_MESSAGES(threadId));

  if (result.success) {
    return {
      success: true as const,
      data: result.data,
    };
  }

  return result;
}

// -----------------------------------------------------------------------------
// Get New Messages (Polling)
// -----------------------------------------------------------------------------
// Use this to poll for new messages after a certain message ID

export async function getNewMessages(threadId: number, lastMessageId: number) {
  const result = await get<{ messages: ChatMessage[] }>(
    ENDPOINTS.CHAT_MESSAGES_NEW(threadId, lastMessageId)
  );

  if (result.success) {
    return {
      success: true as const,
      data: result.data,
    };
  }

  return result;
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

export async function sendMessage(threadId: number, text: string, attachments?: MessageAttachment[]) {
  // Build request matching native web app format
  const request: Record<string, any> = {
    text,
    reply_text: '', // Required by API
  };

  // Add attachments as array of URL strings (native app format)
  if (attachments && attachments.length > 0) {
    request.mediaItems = attachments.map(a => a.url);
  }

  const result = await post<SendMessageResponse>(ENDPOINTS.CHAT_MESSAGES(threadId), request);

  if (result.success) {
    return {
      success: true as const,
      data: result.data,
    };
  }

  return result;
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
// Get Unread Thread Count
// -----------------------------------------------------------------------------

export async function getUnreadCount(): Promise<number> {
  const result = await get<{ unread_threads: Record<string, number> }>(
    ENDPOINTS.CHAT_UNREAD_THREADS
  );

  if (result.success && result.data.unread_threads) {
    return Object.keys(result.data.unread_threads).length;
  }

  return 0;
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
// Mark Threads as Read
// -----------------------------------------------------------------------------

export async function markThreadsRead(threadIds: number[]) {
  return post(ENDPOINTS.CHAT_MARK_READ, { thread_ids: threadIds });
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const messagesApi = {
  getThreads,
  createThread,
  getMessages,
  getNewMessages,
  sendMessage,
  startChatWithUser,
  getUnreadCount,
  getUnreadThreadIds,
  markThreadsRead,
};

export default messagesApi;
