// =============================================================================
// USER CHAT SCREEN - Chat addressed by user ID
// =============================================================================
// Route: /messages/user/[userId]
// Features:
// - Resolves existing thread with this user, or shows empty compose
// - First message creates thread via startChatWithUser()
// - Full chat: message bubbles, send, poll, Pusher real-time
// - Navigate to participant profile
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { DropdownMenu } from '@/components/common';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import { ChatInput, ChatInputAttachment, ChatInputReplyTo, DateSeparator, MessageBubble } from '@/components/message';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNewMessageListener, useMessageDeletedListener, useReactionListener } from '@/contexts/PusherContext';
import { messagesApi } from '@/services/api/messages';
import { isUserOnline, formatLastActivity } from '@/utils/formatDate';
import { IntendedObject } from '@/types/message';
import {
  ChatMessage,
  ChatThread,
  ThreadDetails,
  getMessagePreview,
} from '@/types/message';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const POLL_INTERVAL = 3000;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function UserChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, threadId: threadIdParam, displayName, avatar } = useLocalSearchParams<{
    userId: string;
    threadId?: string;
    displayName?: string;
    avatar?: string;
  }>();
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();

  // State
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [threadDetails, setThreadDetails] = useState<ThreadDetails | null>(null);
  const [intendedUser, setIntendedUser] = useState<IntendedObject | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cursor-based pagination state (v2.2.0)
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Block state
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [chatMenuVisible, setChatMenuVisible] = useState(false);

  // Reply state
  const [replyTo, setReplyTo] = useState<ChatInputReplyTo | null>(null);

  // Refs
  const listRef = useRef<any>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageIdRef = useRef<number>(0);

  const targetUserId = parseInt(userId || '0', 10);
  const knownThreadId = threadIdParam ? parseInt(threadIdParam, 10) : null;
  const currentUserId = user?.id || 0;

  // Header display: prefer threadDetails.info > intendedUser > route params
  const headerName = threadDetails?.info?.title
    || intendedUser?.title
    || displayName
    || 'Chat';
  const headerAvatar = threadDetails?.info?.photo
    || intendedUser?.photo
    || avatar
    || null;
  const headerUsername = threadDetails?.info?.username;
  const headerOnline = isUserOnline(threadDetails?.info?.last_activity);
  const headerActivity = formatLastActivity(threadDetails?.info?.last_activity);

  // ---------------------------------------------------------------------------
  // Resolve Thread - Server-side resolution via user_id param
  // ---------------------------------------------------------------------------

  // Load messages for a known thread (direct access, like native chat?thread_id=X)
  const loadThreadMessages = useCallback(async (threadId: number) => {
    try {
      setError(null);
      const response = await messagesApi.getMessages(threadId);

      if (response.success) {
        // v2.2.0: messages is a flat array in descending order
        const fetchedMessages = (response.data.messages || []).slice().reverse();
        setMessages(fetchedMessages);
        setHasMore(response.data.has_more || false);

        // Set thread with known ID so polling + Pusher work
        setThread({ id: threadId } as ChatThread);

        // Store thread details for header display
        if (response.data.threadDetails) {
          setThreadDetails(response.data.threadDetails);
          if (response.data.threadDetails.blocked_thread) {
            setIsBlocked(true);
          }
        }

        if (fetchedMessages.length > 0) {
          const maxId = Math.max(...fetchedMessages.map(m => m.id));
          lastMessageIdRef.current = maxId;
        }
      } else {
        setError('Failed to load messages');
      }

      messagesApi.markThreadsRead([threadId]).catch(() => {});
    } catch (err) {
      console.error('[UserChat] Load error:', err);
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, []);

  // Resolve thread by userId via user_id query param (v2.2.0)
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
          // v2.2.0: flat array in descending order
          const fetchedMessages = (messagesResponse.data.messages || []).slice().reverse();
          setMessages(fetchedMessages);
          setHasMore(messagesResponse.data.has_more || false);

          // Store thread details for header
          if (messagesResponse.data.threadDetails) {
            setThreadDetails(messagesResponse.data.threadDetails);
          }

          if (fetchedMessages.length > 0) {
            const maxId = Math.max(...fetchedMessages.map(m => m.id));
            lastMessageIdRef.current = maxId;
          }
        }

        messagesApi.markThreadsRead([selectedThread.id]).catch(() => {});
      } else if (response.data.intended_object) {
        // No thread yet — store intended user info for header display
        setIntendedUser(response.data.intended_object);
      }
    } catch (err) {
      console.error('[UserChat] Resolve error:', err);
      setError('Failed to load conversation');
    } finally {
      setLoading(false);
    }
  }, [targetUserId]);

  // Initial load — branch like native: thread_id (direct) vs user_id (resolve)
  useEffect(() => {
    if (knownThreadId) {
      loadThreadMessages(knownThreadId);
    } else {
      resolveThreadByUser();
    }
  }, [knownThreadId, loadThreadMessages, resolveThreadByUser]);

  // ---------------------------------------------------------------------------
  // Poll for new messages (only when thread exists)
  // ---------------------------------------------------------------------------

  const pollNewMessages = useCallback(async () => {
    if (!thread || lastMessageIdRef.current === 0) return;

    try {
      const response = await messagesApi.getNewMessages(thread.id, lastMessageIdRef.current);

      if (response.success && response.data.messages?.length > 0) {
        const newMessages = response.data.messages;

        setMessages(prev => [...prev, ...newMessages]);

        const maxId = Math.max(...newMessages.map(m => m.id));
        lastMessageIdRef.current = maxId;

        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (err) {
      console.error('[UserChat] Poll error:', err);
    }
  }, [thread]);

  useEffect(() => {
    if (!thread) return;

    pollIntervalRef.current = setInterval(() => {
      pollNewMessages();
    }, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [pollNewMessages, thread]);

  // ---------------------------------------------------------------------------
  // Pusher Real-time Messages
  // ---------------------------------------------------------------------------

  useNewMessageListener((data) => {
    const msgThreadId = data.thread_id || data.message.thread_id;
    // Only add message if it's for this thread
    if (thread && String(msgThreadId) === String(thread.id)) {
      const newMessage: ChatMessage = {
        id: data.message.id,
        thread_id: data.message.thread_id,
        user_id: data.message.user_id,
        text: data.message.text,
        created_at: data.message.created_at,
        xprofile: data.message.xprofile,
      };

      setMessages(prev => {
        const exists = prev.some(m => m.id === newMessage.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });

      lastMessageIdRef.current = Math.max(lastMessageIdRef.current, newMessage.id);

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [thread]);

  // Handle message deleted by other user (v2.2.0)
  useMessageDeletedListener((data) => {
    if (thread && String(data.thread_id) === String(thread.id)) {
      setMessages(prev => prev.filter(m => m.id !== data.message_id));
    }
  }, [thread]);

  // Handle reaction updates (v2.2.0 — prep for reaction UI)
  useReactionListener((data) => {
    if (thread && String(data.thread_id) === String(thread.id)) {
      setMessages(prev => prev.map(m => {
        if (m.id === data.message_id) {
          return { ...m, meta: { ...m.meta, reactions: data.reactions } };
        }
        return m;
      }));
    }
  }, [thread]);

  // ---------------------------------------------------------------------------
  // Load Older Messages (Cursor-based pagination v2.2.0)
  // ---------------------------------------------------------------------------

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore || !thread || messages.length === 0) return;

    setLoadingOlder(true);
    try {
      // messages[0] is the oldest after reversal — use its ID as cursor
      const oldestId = messages[0].id;
      const response = await messagesApi.getMessages(thread.id, oldestId);

      if (response.success) {
        const olderMessages = (response.data.messages || []).slice().reverse();
        setMessages(prev => [...olderMessages, ...prev]);
        setHasMore(response.data.has_more || false);
      }
    } catch (err) {
      console.error('[UserChat] Load older error:', err);
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
  // Long Press (Reply / Delete)
  // ---------------------------------------------------------------------------

  const handleLongPress = useCallback((message: ChatMessage) => {
    const isOwn = Number(message.user_id) === currentUserId;
    const options: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      {
        text: 'Reply',
        onPress: () => {
          setReplyTo({
            messageId: message.id,
            previewText: getMessagePreview(message.text, 80),
          });
        },
      },
    ];

    if (isOwn) {
      options.push({
        text: 'Delete',
        style: 'destructive',
        onPress: () => handleDeleteMessage(message),
      });
    }

    options.push({ text: 'Cancel', style: 'cancel' });

    Alert.alert('Message', undefined, options);
  }, [currentUserId, handleDeleteMessage]);

  // ---------------------------------------------------------------------------
  // Block User (from chat)
  // ---------------------------------------------------------------------------

  const handleBlockPress = useCallback(() => {
    if (!thread || blockLoading) return;

    const action = isBlocked ? 'Unblock' : 'Block';
    const message = isBlocked
      ? `Are you sure you want to unblock ${headerName}?`
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
            console.error('[UserChat] Block error:', err);
            Alert.alert('Error', `Failed to ${action.toLowerCase()} user`);
          } finally {
            setBlockLoading(false);
          }
        },
      },
    ]);
  }, [thread, headerName, isBlocked, blockLoading]);

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
      console.error('[UserChat] Unblock error:', err);
      Alert.alert('Error', 'Failed to unblock user');
    } finally {
      setBlockLoading(false);
    }
  }, [thread, blockLoading]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSend = async (text: string, attachments?: ChatInputAttachment[]) => {
    if (!targetUserId) return;

    // Capture and clear reply before sending
    const currentReply = replyTo;
    setReplyTo(null);

    setSending(true);

    try {
      if (thread) {
        // Existing thread — send message normally
        const replyData = currentReply
          ? { reply_to: currentReply.messageId, reply_text: currentReply.previewText }
          : undefined;
        const response = await messagesApi.sendMessage(thread.id, text, attachments, replyData);

        if (response.success && response.data.message) {
          setMessages(prev => [...prev, response.data.message]);
          lastMessageIdRef.current = response.data.message.id;

          setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } else {
          Alert.alert('Error', 'Failed to send message');
        }
      } else {
        // No thread yet — create one with the first message
        const response = await messagesApi.startChatWithUser(targetUserId, text);

        if (response.success && response.data?.thread) {
          const newThread = response.data.thread;
          setThread(newThread);

          // Load the messages for the newly created thread
          const messagesResponse = await messagesApi.getMessages(newThread.id);
          if (messagesResponse.success) {
            // v2.2.0: flat array in descending order
            const fetchedMessages = (messagesResponse.data.messages || []).slice().reverse();
            setMessages(fetchedMessages);
            setHasMore(messagesResponse.data.has_more || false);

            if (messagesResponse.data.threadDetails) {
              setThreadDetails(messagesResponse.data.threadDetails);
            }

            if (fetchedMessages.length > 0) {
              const maxId = Math.max(...fetchedMessages.map(m => m.id));
              lastMessageIdRef.current = maxId;
            }
          }

          setTimeout(() => {
            listRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } else {
          Alert.alert('Error', 'Failed to start conversation');
        }
      }
    } catch (err) {
      console.error('[UserChat] Send error:', err);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleAvatarPress = (message: ChatMessage) => {
    const username = message.xprofile?.username;
    if (username) {
      router.push(`/profile/${username}` as any);
    }
  };

  const handleHeaderPress = () => {
    if (headerUsername) {
      router.push(`/profile/${headerUsername}` as any);
    }
  };

  // ---------------------------------------------------------------------------
  // Render Header
  // ---------------------------------------------------------------------------

  const renderHeaderCenter = () => (
    <Pressable style={styles.headerCenter} onPress={handleHeaderPress}>
      <Avatar
        source={headerAvatar}
        size="sm"
        fallback={headerName}
        online={headerOnline}
      />
      <View style={styles.headerTextColumn}>
        <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
          {headerName}
        </Text>
        {headerActivity ? (
          <Text
            style={[
              styles.headerSubtitle,
              { color: headerOnline ? themeColors.online : themeColors.textTertiary },
            ]}
            numberOfLines={1}
          >
            {headerActivity}
          </Text>
        ) : null}
      </View>
      {loading && (
        <ActivityIndicator size="small" color={themeColors.primary} style={styles.headerLoader} />
      )}
    </Pressable>
  );

  // ---------------------------------------------------------------------------
  // Render Messages
  // ---------------------------------------------------------------------------

  const getMessageDate = (dateString: string) => {
    return new Date(dateString).toDateString();
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn = Number(item.user_id) === currentUserId;

    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showDateSeparator = !prevMessage ||
      getMessageDate(item.created_at) !== getMessageDate(prevMessage.created_at);

    const isFirstInGroup = !prevMessage ||
      Number(prevMessage.user_id) !== Number(item.user_id) ||
      getMessageDate(item.created_at) !== getMessageDate(prevMessage.created_at);

    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
    const isLastInGroup = !nextMessage ||
      Number(nextMessage.user_id) !== Number(item.user_id) ||
      getMessageDate(item.created_at) !== getMessageDate(nextMessage.created_at);

    return (
      <>
        {showDateSeparator && <DateSeparator date={item.created_at} />}
        <MessageBubble
          message={item}
          isOwn={isOwn}
          showAvatar={!isOwn && isFirstInGroup}
          showTimestamp={isLastInGroup}
          onAvatarPress={() => handleAvatarPress(item)}
          onLongPress={handleLongPress}
          onDelete={isOwn ? handleDeleteMessage : undefined}
        />
      </>
    );
  };

  // ---------------------------------------------------------------------------
  // Render Empty State (no thread yet)
  // ---------------------------------------------------------------------------

  const renderEmptyCompose = () => (
    <View style={styles.emptyContainer}>
      <Avatar
        source={headerAvatar}
        size="lg"
        fallback={headerName}
      />
      <Text style={[styles.emptyName, { color: themeColors.text }]}>
        {headerName}
      </Text>
      <Text style={[styles.emptyHint, { color: themeColors.textSecondary }]}>
        Start a chat session with {headerName} by sending the first message.
      </Text>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <Pressable
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color={themeColors.text} />
          </Pressable>

          {renderHeaderCenter()}

          <Pressable
            style={({ pressed }) => [styles.headerGearButton, pressed && { opacity: 0.7 }]}
            onPress={() => setChatMenuVisible(true)}
          >
            <Ionicons name="settings-outline" size={20} color={themeColors.text} />
          </Pressable>
        </View>

        {/* Chat Area */}
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior="padding"
          keyboardVerticalOffset={insets.top + 52}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={themeColors.primary} />
            </View>
          ) : messages.length === 0 ? (
            renderEmptyCompose()
          ) : (
            <FlashList
              ref={listRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              ListHeaderComponent={
                loadingOlder ? (
                  <View style={styles.loadOlderContainer}>
                    <ActivityIndicator size="small" color={themeColors.primary} />
                  </View>
                ) : hasMore ? (
                  <Pressable style={styles.loadOlderContainer} onPress={loadOlderMessages}>
                    <Text style={[styles.loadOlderText, { color: themeColors.primary }]}>
                      Load earlier messages
                    </Text>
                  </Pressable>
                ) : null
              }
              onLoad={() => {
                listRef.current?.scrollToEnd({ animated: false });
              }}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Blocked State or Input */}
          {isBlocked ? (
            <View style={[styles.blockedContainer, { borderTopColor: themeColors.border, paddingBottom: insets.bottom }]}>
              <Text style={[styles.blockedTitle, { color: themeColors.text }]}>
                You blocked messages from {headerName}
              </Text>
              <Text style={[styles.blockedDescription, { color: themeColors.textSecondary }]}>
                You can't send or receive messages in this chat unless you unblock the user.
              </Text>
              <Pressable
                style={[styles.unblockButton, { borderColor: themeColors.border }]}
                onPress={handleUnblockPress}
                disabled={blockLoading}
              >
                {blockLoading ? (
                  <ActivityIndicator size="small" color={themeColors.text} />
                ) : (
                  <Text style={[styles.unblockButtonText, { color: themeColors.text }]}>
                    Unblock User
                  </Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={{ paddingBottom: insets.bottom }}>
              <ChatInput
                onSend={handleSend}
                sending={sending}
                disabled={loading}
                placeholder={thread ? 'Type a message...' : `Message ${headerName}...`}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      </View>

      {/* Chat Menu Dropdown (block) */}
      <DropdownMenu
        visible={chatMenuVisible}
        onClose={() => setChatMenuVisible(false)}
        items={[
          {
            key: 'block',
            label: isBlocked ? 'Unblock User' : 'Block User',
            icon: isBlocked ? 'person-add-outline' : 'ban-outline',
            onPress: () => { setChatMenuVisible(false); handleBlockPress(); },
            destructive: !isBlocked,
          },
        ] as DropdownMenuItem[]}
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  chatArea: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  headerBackButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },

  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  headerTextColumn: {
    flexShrink: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
  },

  headerSubtitle: {
    fontSize: typography.size.xs,
    marginTop: 1,
  },

  headerLoader: {
    marginLeft: spacing.xs,
  },

  headerGearButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: {
    paddingVertical: spacing.md,
  },

  // Empty compose state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },

  emptyName: {
    fontSize: typography.size.xl,
    fontWeight: '600',
    marginTop: spacing.sm,
  },

  emptyHint: {
    fontSize: typography.size.md,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Load older messages
  loadOlderContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },

  loadOlderText: {
    fontSize: typography.size.sm,
    fontWeight: '500',
  },

  // Blocked state
  blockedContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    gap: spacing.sm,
  },

  blockedTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    textAlign: 'center',
  },

  blockedDescription: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  unblockButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: 20,
    borderWidth: 1,
    minWidth: 160,
    alignItems: 'center',
  },

  unblockButtonText: {
    fontSize: typography.size.md,
    fontWeight: '500',
  },
});
