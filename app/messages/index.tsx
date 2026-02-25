// =============================================================================
// MESSAGES SCREEN - Conversations list
// =============================================================================
// Route: /messages (ROOT LEVEL - accessed from header mail icon)
// Features:
// - List of conversations (threads)
// - Pull-to-refresh
// - Navigate to chat thread on tap
// - Swipe to delete conversation
// =============================================================================

import { EmptyState, ErrorMessage, LoadingSpinner } from '@/components/common';
import { ConversationCard, NewMessageModal } from '@/components/message';
import { PageHeader } from '@/components/navigation';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { getMessagePreview, getThreadDisplayName, getThreadAvatar, getThreadUserId, getThreadUsername } from '@/types/message';
import { useAuth } from '@/contexts/AuthContext';
import { useNewMessageListener, useNewThreadListener, useMessageDeletedListener, useThreadUpdatedListener } from '@/contexts/PusherContext';
import { messagesApi } from '@/services/api/messages';
import { ChatThread } from '@/types/message';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const POLL_INTERVAL = 30000; // 30 seconds for background polling

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();

  // State
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [unreadThreadIds, setUnreadThreadIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Polling ref
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch Threads
  // ---------------------------------------------------------------------------

  const fetchThreads = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (threads.length === 0) {
        setLoading(true);
      }
      setError(null);

      const response = await messagesApi.getThreads();

      if (response.success) {
        setThreads(response.data.threads || []);
      } else {
        setError('Failed to load conversations');
      }
    } catch (err) {
      setError('Failed to load conversations');
      if (__DEV__) console.error('[Messages] Fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [threads.length]);

  // Fetch unread thread IDs
  const fetchUnreadThreadIds = useCallback(async () => {
    try {
      const ids = await messagesApi.getUnreadThreadIds();
      setUnreadThreadIds(ids);
    } catch (err) {
      if (__DEV__) console.error('[Messages] Fetch unread error:', err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchThreads();
    fetchUnreadThreadIds();
  }, []);

  // Background polling (fallback if Pusher disconnects)
  useEffect(() => {
    pollIntervalRef.current = setInterval(() => {
      fetchThreads();
      fetchUnreadThreadIds();
    }, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchThreads]);

  // ---------------------------------------------------------------------------
  // Pusher Real-time Updates
  // ---------------------------------------------------------------------------

  // Handle new thread notifications
  useNewThreadListener((data) => {
    const newThread: ChatThread = {
      id: data.thread.id,
      title: data.thread.title,
      message_count: String(data.thread.messages?.length || 1),
      status: (data.thread.status as ChatThread['status']) || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      info: data.thread.info,
      messages: data.thread.messages || [],
    };

    // Add to top of list if not already present
    setThreads(prev => {
      const exists = prev.some(t => t.id === newThread.id);
      if (exists) return prev;
      return [newThread, ...prev];
    });
  }, []);

  // Handle new message notifications - update thread preview
  useNewMessageListener((data) => {
    const threadId = data.thread_id || data.message.thread_id;

    setThreads(prev => {
      const threadExists = prev.some(t => String(t.id) === String(threadId));

      if (threadExists) {
        // Update existing thread with new message preview
        return prev.map(thread => {
          if (String(thread.id) === String(threadId)) {
            return {
              ...thread,
              message_count: String(Number(thread.message_count || 0) + 1),
              updated_at: new Date().toISOString(),
              messages: [{
                id: data.message.id,
                thread_id: data.message.thread_id,
                user_id: data.message.user_id,
                text: data.message.text,
                created_at: data.message.created_at,
              }],
            };
          }
          return thread;
        });
      } else {
        // Thread not in our list — refetch to pick up the new thread
        fetchThreads();
        return prev;
      }
    });
  }, [fetchThreads]);

  // Handle message deleted — update thread if the deleted message was the preview
  useMessageDeletedListener((data) => {
    // Just refetch to get updated preview since we can't reconstruct it
    fetchThreads();
  }, [fetchThreads]);

  // Handle thread updated — update thread metadata
  useThreadUpdatedListener((data) => {
    if (data.thread) {
      setThreads(prev => prev.map(thread => {
        if (thread.id === data.thread.id) {
          return { ...thread, ...data.thread };
        }
        return thread;
      }));
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Filtered Threads (Client-side search)
  // ---------------------------------------------------------------------------

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;

    const query = searchQuery.toLowerCase().trim();
    return threads.filter(thread => {
      // Search by participant name (from info field)
      const displayName = getThreadDisplayName(thread);
      const nameMatch = displayName.toLowerCase().includes(query);

      // Search by username
      const username = getThreadUsername(thread);
      const usernameMatch = username ? username.toLowerCase().includes(query) : false;

      // Search by last message preview
      const lastMessage = thread.messages?.[thread.messages.length - 1];
      const messageMatch = lastMessage
        ? getMessagePreview(lastMessage.text, 200).toLowerCase().includes(query)
        : false;

      return nameMatch || usernameMatch || messageMatch;
    });
  }, [threads, searchQuery]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    fetchThreads(true);
    fetchUnreadThreadIds();
  };

  const handleThreadPress = (thread: ChatThread) => {
    const userId = getThreadUserId(thread);
    const displayName = getThreadDisplayName(thread);
    const avatarUrl = getThreadAvatar(thread);

    router.push({
      pathname: '/messages/user/[userId]',
      params: {
        userId: String(userId || 0),
        threadId: String(thread.id),
        displayName: displayName || 'Chat',
        avatar: avatarUrl || '',
      },
    } as any);
  };

  const handleDeleteThread = (thread: ChatThread) => {
    const displayName = getThreadDisplayName(thread);
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete your conversation with ${displayName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await messagesApi.deleteThread(thread.id);
              if (result.success) {
                setThreads(prev => prev.filter(t => t.id !== thread.id));
              } else {
                Alert.alert('Error', 'Failed to delete conversation');
              }
            } catch (err) {
              if (__DEV__) console.error('[Messages] Delete thread error:', err);
              Alert.alert('Error', 'Failed to delete conversation');
            }
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <EmptyState
        icon="chatbubbles-outline"
        title="No Conversations"
        message="Start a conversation by visiting someone's profile and tapping the message button."
      />
    );
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: themeColors.background }]}>
        {/* Header */}
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title="Messages"
          rightIcon="add"
          onRightPress={() => setShowNewMessageModal(true)}
        />

        {/* New Message Modal */}
        <NewMessageModal
          visible={showNewMessageModal}
          onClose={() => setShowNewMessageModal(false)}
        />

        {/* Search Bar */}
        {threads.length > 0 && (
          <View style={[styles.searchContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Ionicons name="search" size={20} color={themeColors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder="Search conversations..."
              placeholderTextColor={themeColors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {loading && threads.length === 0 ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} onRetry={() => fetchThreads()} />
        ) : (
          <FlashList
            data={filteredThreads}
            renderItem={({ item }) => (
              <ConversationCard
                thread={item}
                currentUserId={user?.id || 0}
                isUnread={unreadThreadIds.includes(item.id)}
                onPress={handleThreadPress}
                onDelete={handleDeleteThread}
              />
            )}
            keyExtractor={(item) => item.id.toString()}
            ListEmptyComponent={renderEmpty}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={[themeColors.primary]}
                tintColor={themeColors.primary}
              />
            }
          />
        )}
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
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    gap: spacing.xs,
  },

  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    paddingVertical: spacing.sm,
  },
});
