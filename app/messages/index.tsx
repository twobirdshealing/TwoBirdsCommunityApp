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

import { EmptyState } from '@/components/common/EmptyState';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ConversationCard } from '@/components/message/ConversationCard';
import { createLogger } from '@/utils/logger';

const log = createLogger('Messages');
import { NewMessageModal } from '@/components/message/NewMessageModal';
import { PageHeader, HeaderTitle } from '@/components/navigation/PageHeader';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { getMessagePreview, getThreadDisplayName, getThreadAvatar, getThreadUserId, getThreadUsername } from '@/types/message';
import { useAuth } from '@/contexts/AuthContext';
import { useNewMessageListener } from '@/contexts/PusherContext';
import { messagesApi } from '@/services/api/messages';
import { ChatThread } from '@/types/message';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useAppQuery } from '@/hooks/useAppQuery';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function MessagesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();

  // State
  const [showNewMessageModal, setShowNewMessageModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ---------------------------------------------------------------------------
  // Fetch Threads + Unread IDs (cached + focus refresh)
  // ---------------------------------------------------------------------------

  interface MessagesData {
    threads: ChatThread[];
    unreadThreadIds: number[];
  }

  const {
    data: messagesData,
    isLoading: loading,
    isRefreshing: refreshing,
    error: fetchError,
    refresh,
    mutate,
  } = useAppQuery<MessagesData>({
    cacheKey: 'tbc_messages_threads',
    fetcher: async () => {
      const [threadsRes, unreadIds] = await Promise.all([
        messagesApi.getThreads(),
        messagesApi.getUnreadThreadIds(),
      ]);

      if (!threadsRes.success) {
        throw new Error('Failed to load conversations');
      }

      return {
        threads: threadsRes.data.threads || [],
        unreadThreadIds: unreadIds,
      };
    },
  });

  const threads = messagesData?.threads || [];
  const unreadThreadIds = messagesData?.unreadThreadIds || [];
  const error = fetchError?.message || null;

  // ---------------------------------------------------------------------------
  // Pusher Real-time Updates
  // ---------------------------------------------------------------------------

  // Handle new message notifications - update thread preview
  useNewMessageListener((data) => {
    const threadId = data.thread_id || data.message.thread_id;

    mutate(prev => {
      if (!prev) return prev;
      const threadExists = prev.threads.some(t => String(t.id) === String(threadId));

      if (threadExists) {
        // Update existing thread with new message preview
        return {
          ...prev,
          threads: prev.threads.map(thread => {
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
          }),
        };
      } else {
        // Thread not in our list — refetch to pick up the new thread
        refresh();
        return prev;
      }
    });
  });


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
    refresh();
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
                mutate(prev => prev ? { ...prev, threads: prev.threads.filter(t => t.id !== thread.id) } : prev);
              } else {
                Alert.alert('Error', 'Failed to delete conversation');
              }
            } catch (err) {
              log.error(err, 'Delete thread error');
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

      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        {/* Header */}
        <PageHeader
          left={<HeaderIconButton icon="chevron-back" onPress={() => router.back()} />}
          center={<HeaderTitle>Messages</HeaderTitle>}
          right={<HeaderIconButton icon="add" onPress={() => setShowNewMessageModal(true)} />}
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
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={themeColors.textSecondary} />
              </Pressable>
            )}
          </View>
        )}

        {loading && threads.length === 0 ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} onRetry={() => refresh()} />
        ) : (
          <FlashList
            data={filteredThreads}
            contentContainerStyle={{ paddingBottom: insets.bottom }}
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
    borderRadius: sizing.borderRadius.sm,
    gap: spacing.xs,
  },

  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    paddingVertical: spacing.sm,
  },
});
