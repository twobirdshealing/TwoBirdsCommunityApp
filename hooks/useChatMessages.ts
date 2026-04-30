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
import {
  useNewMessageListener,
  useReactionListener,
  useThreadUpdatedListener,
  useGroupMemberAddedListener,
  useGroupMemberRemovedListener,
  useGroupAdminChangedListener,
  useGroupDeletedListener,
  useGroupRemovedFromListener,
  usePusher,
} from '@/contexts/PusherContext';
import { createLogger } from '@/utils/logger';
import type {
  PusherMessage,
  PusherReaction,
  PusherThreadUpdated,
  PusherGroupMemberAdded,
  PusherGroupMemberRemoved,
  PusherGroupAdminChanged,
  PusherGroupDeleted,
  PusherGroupRemovedFrom,
} from '@/services/pusher';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';

const log = createLogger('ChatMessages');

// -----------------------------------------------------------------------------
// Types — discriminated by `threadType` so each path gets only the inputs it
// actually uses. The hook narrows on the discriminator internally; callers
// can't accidentally pass `targetUserId` to a group thread or forget
// `threadId` for a space chat.
// -----------------------------------------------------------------------------

interface BaseChatParams {
  currentUserId: number;
  listRef: React.RefObject<any>;
}

interface UserChatParams extends BaseChatParams {
  threadType?: 'user';
  /** The other user's ID — required to resolve or create the thread. */
  targetUserId: number;
  /** When already known (e.g. tapped from a thread row), skips the resolution step. */
  knownThreadId?: number | null;
}

interface GroupChatParams extends BaseChatParams {
  threadType: 'group';
  /** Group thread ID. */
  threadId: number;
  /** Called when the user is removed from / kicked out of the group. The screen should pop. */
  onGroupExit?: (reason: 'deleted' | 'removed') => void;
}

interface SpaceChatParams extends BaseChatParams {
  threadType: 'space';
  /** Community-space thread ID. */
  threadId: number;
}

export type UseChatMessagesParams = UserChatParams | GroupChatParams | SpaceChatParams;

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useChatMessages(params: UseChatMessagesParams) {
  // Normalize the discriminated union into a flat config — TS narrows once
  // here, the rest of the hook reads stable fields and never re-discriminates.
  const cfg = (() => {
    if (params.threadType === 'group') {
      return {
        targetUserId: undefined as number | undefined,
        knownThreadId: params.threadId,
        onGroupExit: params.onGroupExit,
      };
    }
    if (params.threadType === 'space') {
      return {
        targetUserId: undefined as number | undefined,
        knownThreadId: params.threadId,
        onGroupExit: undefined,
      };
    }
    return {
      targetUserId: params.targetUserId,
      knownThreadId: params.knownThreadId ?? null,
      onGroupExit: undefined,
    };
  })();
  const { targetUserId, knownThreadId, onGroupExit } = cfg;
  const { currentUserId, listRef } = params;
  const { isConnected: pusherConnected } = usePusher();
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
        log.warn('Mark read failed:', { e });
      });
    } catch (err) {
      log.error(err, 'Load error');
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
          log.warn('Mark read failed:', { e });
        });
      } else if (response.data.intended_object) {
        setIntendedUser(response.data.intended_object);
      }
    } catch (err) {
      log.error(err, 'Resolve error');
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
  // Group event listeners — patch local thread state in real time.
  // All seven events fire on the same private-chat_user_{user_id} channel and
  // also reach the inbox screen, which patches its own cache. We don't emit
  // CACHE_EVENTS.THREADS for in-list events — that would cause the inbox to
  // do a full refetch on every member-added event.
  // group_deleted / group_removed_from DO emit so the inbox can drop the row
  // even if its own listener missed the payload (defense in depth).
  // ---------------------------------------------------------------------------

  const applyThreadPatch = (incoming: PusherThreadUpdated['thread'] | undefined, fallbackInfo?: PusherThreadUpdated['info']) => {
    if (!incoming && !fallbackInfo) return;
    if (incoming) {
      setThread(prev => (prev ? { ...prev, ...incoming } : incoming));
      setThreadDetails(prev => prev ? { ...prev, ...incoming, info: incoming.info ?? prev.info } : prev);
      return;
    }
    if (fallbackInfo) {
      setThreadDetails(prev => prev ? { ...prev, info: fallbackInfo } : prev);
    }
  };

  const handleThreadUpdated = useEffectEvent((data: PusherThreadUpdated) => {
    const id = data.thread?.id ?? data.thread_id;
    if (!thread || String(id) !== String(thread.id)) return;
    applyThreadPatch(data.thread, data.info);
  });

  const handleGroupMemberAdded = useEffectEvent((data: PusherGroupMemberAdded) => {
    if (!thread || String(data.thread_id) !== String(thread.id)) return;
    applyThreadPatch(data.thread);
  });

  const handleGroupMemberRemoved = useEffectEvent((data: PusherGroupMemberRemoved) => {
    if (!thread || String(data.thread_id) !== String(thread.id)) return;
    applyThreadPatch(data.thread);
  });

  // Server transforms `info.is_admin` for the receiving user, so overlaying
  // `data.thread` correctly updates the current user's admin flag when they
  // were the one promoted/demoted.
  const handleGroupAdminChanged = useEffectEvent((data: PusherGroupAdminChanged) => {
    if (!thread || String(data.thread_id) !== String(thread.id)) return;
    applyThreadPatch(data.thread);
  });

  const handleGroupDeleted = useEffectEvent((data: PusherGroupDeleted) => {
    cacheEvents.emit(CACHE_EVENTS.THREADS);
    if (!thread || String(data.thread_id) !== String(thread.id)) return;
    onGroupExit?.('deleted');
  });

  const handleGroupRemovedFrom = useEffectEvent((data: PusherGroupRemovedFrom) => {
    cacheEvents.emit(CACHE_EVENTS.THREADS);
    if (!thread || String(data.thread_id) !== String(thread.id)) return;
    onGroupExit?.('removed');
  });

  useThreadUpdatedListener(handleThreadUpdated);
  useGroupMemberAddedListener(handleGroupMemberAdded);
  useGroupMemberRemovedListener(handleGroupMemberRemoved);
  useGroupAdminChangedListener(handleGroupAdminChanged);
  useGroupDeletedListener(handleGroupDeleted);
  useGroupRemovedFromListener(handleGroupRemovedFrom);

  // ---------------------------------------------------------------------------
  // Polling fallback — when Pusher isn't connected (firewall, flaky network),
  // poll for new messages every 8s using the lastMessageId cursor. Stops the
  // moment Pusher reports connected again.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (pusherConnected) return;
    if (!thread) return;

    let cancelled = false;
    const POLL_MS = 8000;

    const tick = async () => {
      if (cancelled || !thread) return;
      try {
        const last = lastMessageIdRef.current;
        if (last <= 0) return;
        const response = await messagesApi.getNewMessages(thread.id, last);
        if (cancelled || !response.success) return;
        const fresh = response.data.messages || [];
        if (fresh.length === 0) return;

        let appended = 0;
        setMessages(prev => {
          const seen = new Set(prev.map(m => m.id));
          const additions = fresh.filter(m => !seen.has(m.id));
          appended = additions.length;
          if (appended === 0) return prev;
          return [...prev, ...additions];
        });
        if (appended > 0) {
          lastMessageIdRef.current = Math.max(last, ...fresh.map(m => m.id));
        }
      } catch (err) {
        log.warn('Polling tick failed:', { err });
      }
    };

    const handle = setInterval(tick, POLL_MS);
    // Also run immediately so re-foreground catches up without an 8s delay.
    tick();

    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [pusherConnected, thread]);

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
      log.error(err, 'Load older error');
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
            log.error(err, 'Block error');
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
      log.error(err, 'Unblock error');
      Alert.alert('Error', 'Failed to unblock user');
    } finally {
      setBlockLoading(false);
    }
  }, [thread, blockLoading]);

  // ---------------------------------------------------------------------------
  // Send Message
  // ---------------------------------------------------------------------------

  const handleSend = useCallback(async (text: string, attachments?: ChatInputAttachment[]) => {
    // Group/space threads arrive with a thread loaded but no targetUserId.
    // User threads may have neither yet (still resolving) — bail in that case.
    if (!thread && !targetUserId) return;

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
          Alert.alert('Error', (response as any).error?.message || 'Failed to send message');
        }
      } else {
        // No thread yet — create one (user-chat resolution path only)
        const response = await messagesApi.startChatWithUser(targetUserId!, text);

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
          Alert.alert('Error', !response.success ? response.error?.message : 'Failed to start conversation');
        }
      }
    } catch (err) {
      log.error(err, 'Send error');
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to send message');
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
