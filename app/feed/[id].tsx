// =============================================================================
// SINGLE POST VIEW - View a single post with full content
// =============================================================================
// Route: /feed/{id}
// Used for: notifications, deep links, push notifications
// Reuses FeedCard with variant="full" for consistent rendering
// =============================================================================

import React, { useCallback, useMemo } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { createLogger } from '@/utils/logger';

const log = createLogger('FeedDetail');
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { FeedCard } from '@/components/feed/FeedCard';
import { FeedModalsProvider } from '@/contexts/FeedModalsContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/constants/layout';
import { Feed } from '@/types/feed';
import { feedsApi } from '@/services/api/feeds';
import { useFeedReactions } from '@/hooks/useFeedReactions';
import { useAppQuery } from '@/hooks/useAppQuery';
import { optimisticUpdate } from '@/utils/optimisticUpdate';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SinglePostScreen() {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // ---------------------------------------------------------------------------
  // Fetch single feed
  // ---------------------------------------------------------------------------

  const { data: feed, isLoading: loading, error: fetchError, refresh, mutate } = useAppQuery<Feed>({
    cacheKey: `tbc_feed_${id}`,
    invalidateOn: CACHE_EVENTS.FEEDS,
    fetcher: async () => {
      const numericId = Number(id);
      const response = isNaN(numericId)
        ? await feedsApi.getFeedBySlug(id!)
        : await feedsApi.getFeedById(numericId);
      if (response.success && response.data?.feed) {
        return response.data.feed;
      }
      throw new Error('Post not found');
    },
    enabled: !!id,
  });
  const error = fetchError?.message || null;

  // Adapt single-feed state for the shared reaction hook
  const feedsArray = useMemo(() => feed ? [feed] : [], [feed]);
  const setFeedsArray = useCallback<React.Dispatch<React.SetStateAction<Feed[]>>>((updater) => {
    mutate(prev => {
      const arr = prev ? [prev] : [];
      const result = typeof updater === 'function' ? updater(arr) : updater;
      return result[0] ?? prev;
    });
  }, [mutate]);
  const handleReact = useFeedReactions(feedsArray, setFeedsArray);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleBookmarkToggle = async (isBookmarked: boolean) => {
    if (!feed) return;
    try {
      const response = await optimisticUpdate(
        mutate,
        prev => prev ? { ...prev, bookmarked: isBookmarked } : prev,
        () => feedsApi.toggleBookmark(feed.id, !isBookmarked),
      );
      if (response.success) {
        cacheEvents.emit(CACHE_EVENTS.BOOKMARKS);
      }
    } catch (err) {
      log.error('Failed to bookmark:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update bookmark');
    }
  };

  const handleDelete = () => {
    if (!feed) return;
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await feedsApi.deleteFeed(feed.id);
              router.back();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    if (!feed) return;
    router.push({
      pathname: '/create-post',
      params: { editId: feed.id.toString() },
    });
  };

  const handleCommentPress = () => {
    if (!feed) return;
    router.push({
      pathname: '/comments/[postId]',
      params: { postId: feed.id.toString() },
    });
  };

  // ---------------------------------------------------------------------------
  // Loading & Error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ title: 'Post', headerStyle: { backgroundColor: themeColors.surface }, headerTintColor: themeColors.text }} />
        <LoadingSpinner />
      </View>
    );
  }

  if (error || !feed) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ title: 'Post', headerStyle: { backgroundColor: themeColors.surface }, headerTintColor: themeColors.text }} />
        <ErrorMessage message={error || 'Post not found'} onRetry={refresh} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render - uses FeedCard with variant="full"
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          title: 'Post',
          headerStyle: { backgroundColor: themeColors.surface },
          headerTintColor: themeColors.text,
          headerBackTitle: 'Back',
        }}
      />

      <FeedModalsProvider>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <FeedCard
          feed={feed}
          variant="full"
          onReact={(type) => handleReact(feed.id, type)}
          onAuthorPress={() => {
            if (feed.xprofile?.username) {
              router.push(`/profile/${feed.xprofile.username}`);
            }
          }}
          onSpacePress={() => {
            if (feed.space?.slug) {
              router.push(`/space/${feed.space.slug}`);
            }
          }}
          onCommentPress={handleCommentPress}
          onBookmarkToggle={handleBookmarkToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </ScrollView>
      </FeedModalsProvider>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles (only screen-level styles, FeedCard handles its own)
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingVertical: spacing.md,
  },
});
