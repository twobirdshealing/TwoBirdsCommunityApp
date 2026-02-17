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
import { ChatInput, ChatInputAttachment, DateSeparator, MessageBubble } from '@/components/message';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNewMessageListener } from '@/contexts/PusherContext';
import { messagesApi } from '@/services/api/messages';
import { IntendedObject } from '@/services/api/messages';
import {
  ChatMessage,
  ChatThread,
  getOtherParticipants,
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
  const [intendedUser, setIntendedUser] = useState<IntendedObject | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const hasOlderMessages = currentPage < lastPage;

  // Block state
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [chatMenuVisible, setChatMenuVisible] = useState(false);

  // Refs
  const listRef = useRef<any>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageIdRef = useRef<number>(0);

  const targetUserId = parseInt(userId || '0', 10);
  const knownThreadId = threadIdParam ? parseInt(threadIdParam, 10) : null;
  const currentUserId = user?.id || 0;

  // Header display: prefer thread data > server intended_object > route params
  // Guard: selected_thread from pre_selected may not have xprofiles loaded
  const otherParticipant = thread?.xprofiles ? getOtherParticipants(thread, currentUserId)[0] : null;
  const headerName = otherParticipant?.display_name
    || intendedUser?.title
    || displayName
    || 'Chat';
  const headerAvatar = otherParticipant?.avatar
    || intendedUser?.photo
    || avatar
    || null;
  const headerUsername = otherParticipant?.username;

  // ---------------------------------------------------------------------------
  // Resolve Thread - Server-side resolution via pre_selected param
  // ---------------------------------------------------------------------------

  // Load messages for a known thread (direct access, like native chat?thread_id=X)
  const loadThreadMessages = useCallback(async (threadId: number) => {
    try {
      setError(null);
      const response = await messagesApi.getMessages(threadId);

      if (response.success) {
        const fetchedMessages = (response.data.messages?.data || []).slice().reverse();
        setMessages(fetchedMessages);

        // Plugin returns threadDetails (metadata), not a ChatThread object.
        // Set minimal thread with known ID so polling + Pusher work.
        setThread({ id: threadId } as ChatThread);

        // Seed pagination state from Laravel paginated response
        const paginated = response.data.messages;
        if (paginated) {
          setCurrentPage(paginated.current_page);
          setLastPage(paginated.last_page);
        }

        // Seed blocked state from threadDetails
        if (response.data.threadDetails?.blocked_thread) {
          setIsBlocked(true);
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

  // Resolve thread by userId via pre_selected API (like native chat?user_id=X)
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
        // Thread exists — use full thread from threads array (has xprofiles)
        const selectedThread = (response.data.threads || []).find(
          t => t.id === response.data.selected_thread!.id
        ) || response.data.selected_thread;
        setThread(selectedThread);

        const messagesResponse = await messagesApi.getMessages(selectedThread.id);

        if (messagesResponse.success) {
          const fetchedMessages = (messagesResponse.data.messages?.data || []).slice().reverse();
          setMessages(fetchedMessages);

          // Seed pagination state
          const paginated = messagesResponse.data.messages;
          if (paginated) {
            setCurrentPage(paginated.current_page);
            setLastPage(paginated.last_page);
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
    // Only add message if it's for this thread
    if (thread && String(data.message.thread_id) === String(thread.id)) {
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

  // ---------------------------------------------------------------------------
  // Load Older Messages (Pagination)
  // ---------------------------------------------------------------------------

  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasOlderMessages || !thread) return;

    setLoadingOlder(true);
    try {
      const nextPage = currentPage + 1;
      const response = await messagesApi.getMessages(thread.id, nextPage);

      if (response.success) {
        const olderMessages = (response.data.messages?.data || []).slice().reverse();
        setMessages(prev => [...olderMessages, ...prev]);
        setCurrentPage(response.data.messages.current_page);
        setLastPage(response.data.messages.last_page);
      }
    } catch (err) {
      console.error('[UserChat] Load older error:', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, hasOlderMessages, thread, currentPage]);

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

    setSending(true);

    try {
      if (thread) {
        // Existing thread — send message normally
        const response = await messagesApi.sendMessage(thread.id, text, attachments);

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
            const fetchedMessages = (messagesResponse.data.messages?.data || []).slice().reverse();
            setMessages(fetchedMessages);

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
      />
      <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
        {headerName}
      </Text>
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
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 52 : 0}
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
                ) : hasOlderMessages ? (
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

  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
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
