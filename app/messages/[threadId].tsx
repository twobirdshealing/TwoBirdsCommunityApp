// =============================================================================
// CHAT THREAD SCREEN - Individual conversation view
// =============================================================================
// Route: /messages/[threadId]
// Features:
// - Message list with bubbles
// - Send new messages
// - Poll for new messages (Phase 1)
// - Navigate to participant profile
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { ChatInput, ChatInputAttachment, DateSeparator, MessageBubble } from '@/components/message';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useNewMessageListener } from '@/contexts/PusherContext';
import { messagesApi } from '@/services/api/messages';
import {
  ChatMessage,
  ChatThread,
  getOtherParticipants,
  getThreadAvatar,
  getThreadDisplayName,
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

const POLL_INTERVAL = 3000; // 3 seconds for active chat polling

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ChatThreadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const { user } = useAuth();

  // State
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const listRef = useRef<any>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMessageIdRef = useRef<number>(0);

  const threadIdNum = parseInt(threadId || '0', 10);
  const currentUserId = user?.id || 0;

  // ---------------------------------------------------------------------------
  // Fetch Messages
  // ---------------------------------------------------------------------------

  const fetchMessages = useCallback(async () => {
    if (!threadIdNum) return;

    try {
      setError(null);

      const response = await messagesApi.getMessages(threadIdNum);

      if (response.success) {
        // API returns paginated response: messages.data contains the array
        // API returns newest first, so reverse for chat display (oldest at top)
        const fetchedMessages = (response.data.messages?.data || []).slice().reverse();
        setMessages(fetchedMessages);

        // Update thread info if available
        if (response.data.thread) {
          setThread(response.data.thread);
        }

        // Update last message ID for polling
        if (fetchedMessages.length > 0) {
          const maxId = Math.max(...fetchedMessages.map(m => m.id));
          lastMessageIdRef.current = maxId;
        }
      } else {
        setError('Failed to load messages');
      }
    } catch (err) {
      setError('Failed to load messages');
      console.error('[ChatThread] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [threadIdNum]);

  // Poll for new messages
  const pollNewMessages = useCallback(async () => {
    if (!threadIdNum || lastMessageIdRef.current === 0) return;

    try {
      const response = await messagesApi.getNewMessages(threadIdNum, lastMessageIdRef.current);

      if (response.success && response.data.messages?.length > 0) {
        const newMessages = response.data.messages;

        setMessages(prev => [...prev, ...newMessages]);

        // Update last message ID
        const maxId = Math.max(...newMessages.map(m => m.id));
        lastMessageIdRef.current = maxId;

        // Scroll to bottom
        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (err) {
      console.error('[ChatThread] Poll error:', err);
    }
  }, [threadIdNum]);

  // Initial load + mark thread as read
  useEffect(() => {
    fetchMessages();

    // Mark thread as read when opened
    if (threadIdNum) {
      messagesApi.markThreadsRead([threadIdNum]).catch(() => {
        // Silent fail - not critical
      });
    }
  }, [fetchMessages, threadIdNum]);

  // Polling for new messages (fallback if Pusher disconnects)
  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      pollNewMessages();
    }, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [pollNewMessages]);

  // ---------------------------------------------------------------------------
  // Pusher Real-time Messages
  // ---------------------------------------------------------------------------

  useNewMessageListener((data) => {
    // Only add message if it's for this thread
    if (String(data.message.thread_id) === String(threadIdNum)) {
      const newMessage: ChatMessage = {
        id: data.message.id,
        thread_id: data.message.thread_id,
        user_id: data.message.user_id,
        text: data.message.text,
        created_at: data.message.created_at,
        xprofile: data.message.xprofile,
      };

      // Add to messages if not already present (avoid duplicates)
      setMessages(prev => {
        const exists = prev.some(m => m.id === newMessage.id);
        if (exists) return prev;
        return [...prev, newMessage];
      });

      // Update last message ID
      lastMessageIdRef.current = Math.max(lastMessageIdRef.current, newMessage.id);

      // Scroll to bottom
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [threadIdNum]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSend = async (text: string, attachments?: ChatInputAttachment[]) => {
    if (!threadIdNum) return;

    setSending(true);

    try {
      const response = await messagesApi.sendMessage(threadIdNum, text, attachments);

      if (response.success && response.data.message) {
        // Add new message to list (images are embedded in message.text HTML)
        setMessages(prev => [...prev, response.data.message]);

        // Update last message ID
        lastMessageIdRef.current = response.data.message.id;

        // Scroll to bottom
        setTimeout(() => {
          listRef.current?.scrollToEnd({ animated: true });
        }, 100);
      } else {
        Alert.alert('Error', 'Failed to send message');
      }
    } catch (err) {
      console.error('[ChatThread] Send error:', err);
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

  // ---------------------------------------------------------------------------
  // Derived Data
  // ---------------------------------------------------------------------------

  // Get other participants for header
  const otherParticipants = thread ? getOtherParticipants(thread, currentUserId) : [];
  const displayName = thread ? getThreadDisplayName(thread, currentUserId) : 'Chat';
  const avatarUrl = thread ? getThreadAvatar(thread, currentUserId) : null;

  // Navigate to participant profile
  const handleHeaderPress = () => {
    if (otherParticipants.length === 1 && otherParticipants[0].username) {
      router.push(`/profile/${otherParticipants[0].username}` as any);
    }
  };

  // Custom header with avatar
  const renderHeaderCenter = () => (
    <Pressable style={styles.headerCenter} onPress={handleHeaderPress}>
      <Avatar
        source={avatarUrl}
        size="sm"
        fallback={displayName}
      />
      <Text style={styles.headerTitle} numberOfLines={1}>
        {displayName}
      </Text>
      {loading && messages.length > 0 && (
        <ActivityIndicator size="small" color={colors.primary} style={styles.headerLoader} />
      )}
    </Pressable>
  );

  // Group messages by date for separators
  const getMessageDate = (dateString: string) => {
    return new Date(dateString).toDateString();
  };

  // ---------------------------------------------------------------------------
  // Render Item
  // ---------------------------------------------------------------------------

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn = Number(item.user_id) === currentUserId;

    // Check if we need a date separator (comparing with previous message)
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const showDateSeparator = !prevMessage ||
      getMessageDate(item.created_at) !== getMessageDate(prevMessage.created_at);

    // Check if this is first message from this sender (show avatar)
    const isFirstInGroup = !prevMessage ||
      Number(prevMessage.user_id) !== Number(item.user_id) ||
      getMessageDate(item.created_at) !== getMessageDate(prevMessage.created_at);

    // Check if this is last message from this sender (show timestamp)
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
        />
      </>
    );
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header with Avatar */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>

          {renderHeaderCenter()}

          <View style={styles.headerSpacer} />
        </View>

        {/* Messages List */}
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 52 : 0}
        >
          {loading && messages.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlashList
              ref={listRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              onLoad={() => {
                // Scroll to bottom on initial load
                listRef.current?.scrollToEnd({ animated: false });
              }}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Input */}
          <View style={{ paddingBottom: insets.bottom }}>
            <ChatInput
              onSend={handleSend}
              sending={sending}
              disabled={loading && messages.length === 0}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  chatArea: {
    flex: 1,
  },

  // Custom header with avatar
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.text,
  },

  headerLoader: {
    marginLeft: spacing.xs,
  },

  headerSpacer: {
    width: 40,
    height: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: {
    paddingVertical: spacing.md,
  },
});
