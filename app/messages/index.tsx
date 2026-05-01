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
import { ThreadSection } from '@/components/message/ThreadSection';
import { createLogger } from '@/utils/logger';
import { NewMessageModal } from '@/components/message/NewMessageModal';
import { PageHeader, HeaderTitle } from '@/components/navigation/PageHeader';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { getThreadDisplayName, getThreadAvatar, getThreadUserId, getThreadUsername, isGroupThread, isSpaceThread , ChatThread } from '@/types/message';
import { useAuth } from '@/contexts/AuthContext';
import { useNewMessageListener, useNewThreadListener, useThreadUpdatedListener, useGroupDeletedListener, useGroupRemovedFromListener } from '@/contexts/PusherContext';
import { messagesApi } from '@/services/api/messages';
import { setSpaceChannelSubscriptions } from '@/services/pusher';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
import { useDebounce } from '@/hooks/useDebounce';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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

const log = createLogger('Messages');

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
    groupThreads: ChatThread[];
    communityThreads: ChatThread[];
    leftCommunityThreads: ChatThread[];
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
        groupThreads: threadsRes.data.group_threads || [],
        communityThreads: threadsRes.data.community_threads || [],
        leftCommunityThreads: threadsRes.data.left_community_threads || [],
        unreadThreadIds: unreadIds,
      };
    },
  });

  const threads = messagesData?.threads || [];
  const groupThreads = messagesData?.groupThreads || [];
  const communityThreads = messagesData?.communityThreads || [];
  const leftCommunityThreads = messagesData?.leftCommunityThreads || [];
  const unreadThreadIds = messagesData?.unreadThreadIds || [];
  const error = fetchError?.message || null;

  // Section expansion state — all expanded by default, mirrors web UI.
  const [communitiesExpanded, setCommunitiesExpanded] = useState(true);
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [dmsExpanded, setDmsExpanded] = useState(true);

  // ---------------------------------------------------------------------------
  // Pusher: subscribe to private-chat_space_{id} for every active community
  // thread so messages and reactions in space chats stream in real-time. The
  // service diffs against the live subscription set so unchanged channels are
  // left alone. Left-community threads don't subscribe — server stops emitting
  // to them anyway.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const ids = communityThreads
      .map(t => Number(t.space_id))
      .filter(id => Number.isFinite(id) && id > 0);
    setSpaceChannelSubscriptions(ids);
    // No cleanup — the inbox owns this set for its full lifetime; logout (which
    // unmounts everything) calls clearHandlers() which clears it.
  }, [communityThreads]);

  // ---------------------------------------------------------------------------
  // Server-side search — debounced. With the search box empty, we skip the
  // call entirely and use the cached listing. Once the user starts typing,
  // we hit /chat/threads?search= and replace the lists from that response.
  // ---------------------------------------------------------------------------

  const debouncedSearch = useDebounce(searchQuery, 300);
  const [searchResults, setSearchResults] = useState<{
    threads: ChatThread[];
    groupThreads: ChatThread[];
    communityThreads: ChatThread[];
    leftCommunityThreads: ChatThread[];
  } | null>(null);

  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length < 2) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await messagesApi.getThreads({ search: q });
      if (cancelled || !res.success) return;
      setSearchResults({
        threads: res.data.threads || [],
        groupThreads: res.data.group_threads || [],
        communityThreads: res.data.community_threads || [],
        leftCommunityThreads: res.data.left_community_threads || [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  // When a search is active, use its results for the lists; unread IDs always
  // come from the cached listing (server-search doesn't include them).
  const view = {
    threads: searchResults?.threads ?? threads,
    groupThreads: searchResults?.groupThreads ?? groupThreads,
    communityThreads: searchResults?.communityThreads ?? communityThreads,
    leftCommunityThreads: searchResults?.leftCommunityThreads ?? leftCommunityThreads,
    unreadThreadIds,
  };

  // ---------------------------------------------------------------------------
  // Group Pusher events — patch the inbox cache directly so the list stays
  // in sync without an extra fetch on every event. Falls back to refresh()
  // when the affected thread isn't in the cached list yet.
  // ---------------------------------------------------------------------------

  useNewThreadListener((data) => {
    const t = data.thread;
    if (!t) return;
    const isGroup = isGroupThread(t);
    mutate(prev => {
      if (!prev) return prev;
      const list = isGroup ? prev.groupThreads : prev.threads;
      if (list.some(x => String(x.id) === String(t.id))) return prev;
      return isGroup
        ? { ...prev, groupThreads: [t, ...prev.groupThreads] }
        : { ...prev, threads: [t, ...prev.threads] };
    });
  });

  useThreadUpdatedListener((data) => {
    const t = data.thread;
    if (!t) return;
    mutate(prev => {
      if (!prev) return prev;
      const patch = (arr: ChatThread[]) =>
        arr.map(x => (String(x.id) === String(t.id) ? { ...x, ...t } : x));
      return {
        ...prev,
        threads: patch(prev.threads),
        groupThreads: patch(prev.groupThreads),
      };
    });
  });

  useGroupDeletedListener((data) => {
    mutate(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        groupThreads: prev.groupThreads.filter(x => String(x.id) !== String(data.thread_id)),
      };
    });
  });

  useGroupRemovedFromListener((data) => {
    mutate(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        groupThreads: prev.groupThreads.filter(x => String(x.id) !== String(data.thread_id)),
      };
    });
  });

  // Refresh when other screens emit a threads cache event (e.g. detail screen
  // after add/remove members, leave, delete — admin actions originated locally).
  // Stash refresh in a ref so the subscription doesn't churn each render
  // (useAppQuery's refresh identity changes on every state update).
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => cacheEvents.subscribe(CACHE_EVENTS.THREADS, () => refreshRef.current()), []);

  // ---------------------------------------------------------------------------
  // Pusher Real-time Updates
  // ---------------------------------------------------------------------------

  // Handle new message notifications - update thread preview
  useNewMessageListener((data) => {
    const threadId = data.thread_id || data.message.thread_id;

    mutate(prev => {
      if (!prev) return prev;
      const inDms = prev.threads.some(t => String(t.id) === String(threadId));
      const inGroups = prev.groupThreads.some(t => String(t.id) === String(threadId));

      if (!inDms && !inGroups) {
        // Thread not in our list — refetch to pick up the new thread
        refresh();
        return prev;
      }

      const patch = (thread: ChatThread): ChatThread => ({
        ...thread,
        message_count: String(Number(thread.message_count || 0) + 1),
        updated_at: new Date().toISOString(),
        messages: [{
          id: data.message.id,
          thread_id: data.message.thread_id,
          user_id: data.message.user_id,
          text: data.message.text,
          created_at: data.message.created_at,
          xprofile: data.message.xprofile,
        }],
      });

      return {
        ...prev,
        threads: inDms
          ? prev.threads.map(t => (String(t.id) === String(threadId) ? patch(t) : t))
          : prev.threads,
        groupThreads: inGroups
          ? prev.groupThreads.map(t => (String(t.id) === String(threadId) ? patch(t) : t))
          : prev.groupThreads,
      };
    });
  });


  // ---------------------------------------------------------------------------
  // Filtered Threads (Client-side search)
  // ---------------------------------------------------------------------------

  // Build a flat list with section-header sentinels for FlashList. Mixed-type
  // rows give us native section behavior without bringing in SectionList.
  type SectionRow =
    | { kind: 'header'; key: string; title: string; count: number; expanded: boolean; onToggle: () => void }
    | { kind: 'thread'; key: string; thread: ChatThread; faded?: boolean };

  const rows: SectionRow[] = useMemo(() => {
    const out: SectionRow[] = [];
    const activeCommunities = view.communityThreads;
    const leftCommunities = view.leftCommunityThreads;
    const allCommunities = [...activeCommunities, ...leftCommunities];

    if (allCommunities.length > 0) {
      out.push({
        kind: 'header',
        key: 'header-communities',
        title: 'Communities',
        count: allCommunities.length,
        expanded: communitiesExpanded,
        onToggle: () => setCommunitiesExpanded(v => !v),
      });
      if (communitiesExpanded) {
        for (const t of activeCommunities) {
          out.push({ kind: 'thread', key: `community-${t.id}`, thread: t });
        }
        for (const t of leftCommunities) {
          out.push({ kind: 'thread', key: `community-left-${t.id}`, thread: t, faded: true });
        }
      }
    }

    if (view.groupThreads.length > 0) {
      out.push({
        kind: 'header',
        key: 'header-groups',
        title: 'Groups',
        count: view.groupThreads.length,
        expanded: groupsExpanded,
        onToggle: () => setGroupsExpanded(v => !v),
      });
      if (groupsExpanded) {
        for (const t of view.groupThreads) {
          out.push({ kind: 'thread', key: `group-${t.id}`, thread: t });
        }
      }
    }

    if (view.threads.length > 0) {
      out.push({
        kind: 'header',
        key: 'header-dms',
        title: 'Direct Messages',
        count: view.threads.length,
        expanded: dmsExpanded,
        onToggle: () => setDmsExpanded(v => !v),
      });
      if (dmsExpanded) {
        for (const t of view.threads) {
          out.push({ kind: 'thread', key: `dm-${t.id}`, thread: t });
        }
      }
    }
    return out;
  }, [view, communitiesExpanded, groupsExpanded, dmsExpanded]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    refresh();
  };

  const handleThreadPress = (thread: ChatThread, isLeft = false) => {
    if (isGroupThread(thread)) {
      router.push({
        pathname: '/messages/group/[threadId]',
        params: {
          threadId: String(thread.id),
          title: getThreadDisplayName(thread) || 'Group',
        },
      });
      return;
    }

    if (isSpaceThread(thread)) {
      router.push({
        pathname: '/messages/space/[threadId]',
        params: {
          threadId: String(thread.id),
          title: getThreadDisplayName(thread) || 'Community',
          slug: getThreadUsername(thread) || '',
          isLeft: isLeft ? '1' : '0',
        },
      });
      return;
    }

    const userId = getThreadUserId(thread);
    // Thread with no resolvable user id can't open a 1:1 chat. Bail loudly
    // instead of navigating to /messages/user/0 (which loads a broken screen).
    if (userId == null) {
      log.warn('Thread has no user id — cannot open chat', { threadId: thread.id });
      return;
    }
    const displayName = getThreadDisplayName(thread);
    const avatarUrl = getThreadAvatar(thread);

    router.push({
      pathname: '/messages/user/[userId]',
      params: {
        userId: String(userId),
        threadId: String(thread.id),
        displayName: displayName || 'Chat',
        avatar: avatarUrl || '',
      },
    });
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
        {(threads.length > 0 || groupThreads.length > 0 || communityThreads.length > 0 || leftCommunityThreads.length > 0) && (
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

        {loading && rows.length === 0 ? (
          <LoadingSpinner />
        ) : error ? (
          <ErrorMessage message={error} onRetry={() => refresh()} />
        ) : (
          <FlashList
            data={rows}
            contentContainerStyle={{ paddingBottom: insets.bottom }}
            renderItem={({ item }) => {
              if (item.kind === 'header') {
                return (
                  <ThreadSection
                    title={item.title}
                    count={item.count}
                    expanded={item.expanded}
                    onToggle={item.onToggle}
                  />
                );
              }
              return (
                <ConversationCard
                  thread={item.thread}
                  currentUserId={user?.id || 0}
                  isUnread={view.unreadThreadIds.includes(item.thread.id)}
                  onPress={(t) => handleThreadPress(t, item.faded)}
                  // Only DMs support swipe-delete. Groups use Leave/Delete from
                  // the info sheet; community threads use Leave/Rejoin.
                  onDelete={
                    isGroupThread(item.thread) || isSpaceThread(item.thread)
                      ? undefined
                      : handleDeleteThread
                  }
                  faded={item.faded}
                />
              );
            }}
            keyExtractor={(item) => item.key}
            getItemType={(item) => item.kind}
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
