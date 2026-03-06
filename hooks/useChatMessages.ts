// =============================================================================
// USE CHAT MESSAGES - Core chat state & logic for user chat screen
// =============================================================================
// Extracted from messages/user/[userId].tsx to reduce route file size.
// Manages: thread resolution, messages, Pusher real-time, send, block, delete.
// =============================================================================

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { ChatMessage, ChatThread, ThreadDetails, IntendedObject } from '@/types/message';
import type { ChatInputAttachment, ChatInputReplyTo } from '@/components/message/ChatInput';
import { messagesApi } from '@/services/api/messages';
import { useNewMessageListener, useReactionListener } from '@/contexts/PusherContext';
import { createLogger } from '@/utils/logger';
import type { PusherMessage, PusherReaction } from '@/services/pusher';

const log = createLogger('ChatMessages');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseChatMessagesParams {
  targetUserId: number;
  knownThreadId: number | null;
  currentUserId: number;
  listRef: React.RefObject<any>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useChatMessages({
  targetUserId,
  knownThreadId,
  currentUserId,
  listRef,
}: UseChatMessagesParams) {
  // Core state
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [threadDetails, setThreadDetails] = useState<ThreadDetails | null>(null);
  const [intendedUser, setIntendedUser] = useState<IntendedObject | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cursor-based pagination
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Block state
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // Reply state
  const [replyTo, setReplyTo] = useState<ChatInputReplyTo | null>(null);

  // Refs
  const lastMessageIdRef = useRef<number>(0);

  // ---------------------------------------------------------------------------
  // Load messages for a known thread (direct access)
  // ---------------------------------------------------------------------------

  const loadThreadMessages = useCallback(async (threadId: number) => {
    try {
      setError(null);
      const response = await messagesApi.getMessages(threadId);

      if (response.success) {
        const fetchedMessages = (response.data.messages || []).slice().reverse();
        setMessages(fetchedMessages);
        setHasMore(response.data.has_more || false);
        setThread({ id: threadId } as ChatThread);

        if (response.data.threadDetails) {
          setThreadDetails(response.data.threadDetails);
          if (response.data.threadDetails.blocked_thread) {
            setIsBlocked(true);
          }
        }

        if (fetchedMessages.length > 0) {
          lastMessageIdRef.current = Math.max(...fetchedMessages.map(m => m.id));
        }
      } else {
        setError('Failed to load messages');
      }

      messagesApi.markThreadsRead([threadId]).catch((e) => {
        log.warn('Mark read failed:', e);
      });
    } catch (err) {
      log.error('Load error:', err);
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Resolve thread by userId via user_id query param
  // ---------------------------------------------------------------------------

  const resolveThreadByUser = useCallback(async () => {
    if (!targetUserId) return;

    try {
      setError(null);
      const response = await messagesApi.getThreadsForUser(targetUserId);

      if (!response.success) {
        setLoading(false);
        return;
      }

      if (response.data.selected_thread) {
        const selectedThread = response.data.selected_thread;
        setThread(selectedThread);

        const messagesResponse = await messagesApi.getMessages(selectedThread.id);

        if (messagesResponse.success) {
          const fetchedMessages = (messagesResponse.data.messages || []).slice().reverse();
          setMessages(fetchedMessages);
          setHasMore(messagesResponse.data.has_more || false);

          if (messagesResponse.data.threadDetails) {
            setThreadDetails(messagesResponse.data.threadDetails);
          }

          if (fetchedMessages.length > 0) {
            lastMessageIdRef.current = Math.max(...fetchedMessages.map(m => m.id));
          }
        }

        messagesApi.markThreadsRead([selectedThread.id]).catch((e) => {
          log.warn('Mark read failed:', e);
        });
      } else if (response.data.intended_object) {
        setIntendedUser(response.data.intended_object);
      }
    } catch (err) {
      log.error('Resolve error:', err);
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  // ---------------------------------------------------------------------------
  // Initial load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (knownThreadId) {
      loadThreadMessages(knownThreadId);
    } else {
      resolveThreadByUser();
    }
  }, [knownThreadId, loadThreadMessages, resolveThreadByUser]);

  // ---------------------------------------------------------------------------
  // Pusher Real-time
  // ---------------------------------------------------------------------------

  const handleNewMessage = useEffectEvent((data: PusherMessage) => {
    const msgThreadId = data.thread_id || data.message.thread_id;
    if (thread && String(msgThreadId) === String(thread.id)) {
      const newMessage: ChatMessage = data.message;

      setMessages(prev => {
        const exists = prev.some(m => m.id === newMessage.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });

      lastMessageIdRef.current = Math.max(lastMessageIdRef.current, newMessage.id);
      setTimeout(() => { listRef.current?.scrollToEnd({ animated: true }); }, 100);
    }
  });

  const handleReaction = useEffectEvent((data: PusherReaction) => {
    if (thread && String(data.thread_id) === String(thread.id)) {
      setMessages(prev => prev.map(m => {
        if (m.id === data.message_id) {
          return { ...m, meta: { ...m.meta, reactions: data.reactions } };
        }
        return m;
      }));
    }
  });

  useNewMessageListener(handleNewMessage);

  useReactionListener(handleReaction);

  // ---------------------------------------------------------------------------
  // Load Older Messages (cursor-based pagination)
  // ---------------------------------------------------------------------------

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore || !thread || messages.length === 0) return;

    setLoadingOlder(true);
    try {
      const oldestId = messages[0].id;
      const response = await messagesApi.getMessages(thread.id, oldestId);

      if (response.success) {
        const olderMessages = (response.data.messages || []).slice().reverse();
        setMessages(prev => [...olderMessages, ...prev]);
        setHasMore(response.data.has_more || false);
      }
    } catch (err) {
      log.error('Load older error:', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasMore, thread, messages]);

  // ---------------------------------------------------------------------------
  // Delete Message
  // ---------------------------------------------------------------------------

  const handleDeleteMessage = useCallback(async (message: ChatMessage) => {
    Alert.alert('Delete Message', 'Delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const result = await messagesApi.deleteMessage(message.id);
          if (result.success) {
            setMessages(prev => prev.filter(m => m.id !== message.id));
          } else {
            Alert.alert('Error', 'Failed to delete message');
          }
        },
      },
    ]);
  }, []);

  // ---------------------------------------------------------------------------
  // Block / Unblock
  // ---------------------------------------------------------------------------

  const handleBlockPress = useCallback((displayName: string) => {
    if (!thread || blockLoading) return;

    const action = isBlocked ? 'Unblock' : 'Block';
    const message = isBlocked
      ? `Are you sure you want to unblock ${displayName}?`
      : 'Blocking this user will hide their posts from your feed and prevent them from interacting with you.';

    Alert.alert(`${action} User`, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: action,
        style: isBlocked ? 'default' : 'destructive',
        onPress: async () => {
          try {
            setBlockLoading(true);

            if (isBlocked) {
              const result = await messagesApi.unblockThread(thread.id);
              if (result.success) {
                setIsBlocked(false);
              } else {
                Alert.alert('Error', 'Failed to unblock user');
              }
            } else {
              const result = await messagesApi.blockThread(thread.id);
              if (result.success) {
                setIsBlocked(true);
              } else {
                Alert.alert('Error', 'Failed to block user');
              }
            }
          } catch (err) {
            log.error('Block error:', err);
            Alert.alert('Error', `Failed to ${action.toLowerCase()} user`);
          } finally {
            setBlockLoading(false);
          }
        },
      },
    ]);
  }, [thread, isBlocked, blockLoading]);

  const handleUnblockPress = useCallback(async () => {
    if (!thread || blockLoading) return;
    try {
      setBlockLoading(true);
      const result = await messagesApi.unblockThread(thread.id);
      if (result.success) {
        setIsBlocked(false);
      } else {
        Alert.alert('Error', 'Failed to unblock user');
      }
    } catch (err) {
      log.error('Unblock error:', err);
      Alert.alert('Error', 'Failed to unblock user');
    } finally {
      setBlockLoading(false);
    }
  }, [thread, blockLoading]);

  // ---------------------------------------------------------------------------
  // Send Message
  // ---------------------------------------------------------------------------

  const handleSend = useCallback(async (text: string, attachments?: ChatInputAttachment[]) => {
    if (!targetUserId) return;

    // Capture and clear reply before sending
    const currentReply = replyTo;
    setReplyTo(null);
    setSending(true);

    try {
      if (thread) {
        const replyData = currentReply
          ? { reply_to: currentReply.messageId, reply_text: currentReply.previewText }
          : undefined;
        const response = await messagesApi.sendMessage(thread.id, text, attachments, replyData);

        if (response.success && response.data.message) {
          setMessages(prev => [...prev, response.data.message]);
          lastMessageIdRef.current = response.data.message.id;
          setTimeout(() => { listRef.current?.scrollToEnd({ animated: true }); }, 100);
        } else {
          Alert.alert('Error', 'Failed to send message');
        }
      } else {
        // No thread yet — create one
        const response = await messagesApi.startChatWithUser(targetUserId, text);

        if (response.success && response.data?.thread) {
          const newThread = response.data.thread;
          setThread(newThread);

          const messagesResponse = await messagesApi.getMessages(newThread.id);
          if (messagesResponse.success) {
            const fetchedMessages = (messagesResponse.data.messages || []).slice().reverse();
            setMessages(fetchedMessages);
            setHasMore(messagesResponse.data.has_more || false);

            if (messagesResponse.data.threadDetails) {
              setThreadDetails(messagesResponse.data.threadDetails);
            }

            if (fetchedMessages.length > 0) {
              lastMessageIdRef.current = Math.max(...fetchedMessages.map(m => m.id));
            }
          }

          setTimeout(() => { listRef.current?.scrollToEnd({ animated: true }); }, 100);
        } else {
          Alert.alert('Error', 'Failed to start conversation');
        }
      }
    } catch (err) {
      log.error('Send error:', err);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  }, [targetUserId, thread, replyTo, listRef]);

  return {
    // Core state
    thread,
    threadDetails,
    intendedUser,
    messages,
    setMessages,
    loading,
    sending,
    error,
    // Pagination
    hasMore,
    loadingOlder,
    loadOlderMessages,
    // Block
    isBlocked,
    blockLoading,
    handleBlockPress,
    handleUnblockPress,
    // Reply
    replyTo,
    setReplyTo,
    // Actions
    handleDeleteMessage,
    handleSend,
  };
}
