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
import { ConversationCard, NewMessageModal } from '@/components/message';
import { PageHeader } from '@/components/navigation';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { getMessagePreview, getOtherParticipants } from '@/types/message';
import { useAuth } from '@/contexts/AuthContext';
import { useNewMessageListener, useNewThreadListener } from '@/contexts/PusherContext';
import { messagesApi } from '@/services/api/messages';
import { ChatThread } from '@/types/message';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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
      console.error('[Messages] Fetch error:', err);
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
      console.error('[Messages] Fetch unread error:', err);
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
      status: data.thread.status,
      xprofiles: data.thread.xprofiles || [],
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
    // Update the thread's last message when a new message arrives
    setThreads(prev => prev.map(thread => {
      if (String(thread.id) === String(data.message.thread_id)) {
        // Update thread with new message in preview
        return {
          ...thread,
          message_count: String(Number(thread.message_count || 0) + 1),
          messages: [{
            id: data.message.id,
            thread_id: data.message.thread_id,
            user_id: data.message.user_id,
            text: data.message.text,
            created_at: data.message.created_at,
            xprofile: data.message.xprofile,
          }],
        };
      }
      return thread;
    }));
  }, []);

  // ---------------------------------------------------------------------------
  // Filtered Threads (Client-side search)
  // ---------------------------------------------------------------------------

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;

    const query = searchQuery.toLowerCase().trim();
    return threads.filter(thread => {
      // Search by participant names
      const others = getOtherParticipants(thread, user?.id || 0);
      const nameMatch = others.some(p =>
        p.display_name?.toLowerCase().includes(query) ||
        p.username?.toLowerCase().includes(query)
      );

      // Search by last message preview
      const lastMessage = thread.messages?.[thread.messages.length - 1];
      const messageMatch = lastMessage
        ? getMessagePreview(lastMessage.text, 200).toLowerCase().includes(query)
        : false;

      return nameMatch || messageMatch;
    });
  }, [threads, searchQuery, user?.id]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    fetchThreads(true);
    fetchUnreadThreadIds();
  };

  const handleThreadPress = (thread: ChatThread) => {
    router.push(`/messages/${thread.id}` as any);
  };

  const handleDeleteThread = (thread: ChatThread) => {
    // Note: The Fluent Chat API may not have a delete thread endpoint
    // For now, show a message that this feature is not available
    Alert.alert(
      'Delete Conversation',
      'Deleting conversations is not currently supported.',
      [{ text: 'OK' }]
    );
  };

  // ---------------------------------------------------------------------------
  // Render Helpers
  // ---------------------------------------------------------------------------

  const renderEmpty = () => {
    if (loading) return null;

    return (
      <EmptyState
        icon="💬"
        title="No Conversations"
        message="Start a conversation by visiting someone's profile and tapping the message button."
      />
    );
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search conversations..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}

        {loading && threads.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
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
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
          />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    gap: spacing.xs,
  },

  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
});
