// =============================================================================
// BOOKMARKS SCREEN - Shows user's saved posts
// =============================================================================

import { FeedList } from '@/components/feed/FeedList';
import { PageHeader } from '@/components/navigation/PageHeader';
import { createLogger } from '@/utils/logger';

const log = createLogger('Bookmarks');
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { feedsApi } from '@/services/api/feeds';
import { Feed } from '@/types/feed';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedReactions } from '@/hooks/useFeedReactions';
import { useCachedData, useArrayMutate } from '@/hooks/useCachedData';
import { useFeedActions } from '@/hooks/useFeedActions';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
import { optimisticUpdate } from '@/utils/optimisticUpdate';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function BookmarksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  // ---------------------------------------------------------------------------
  // Fetch Bookmarks
  // ---------------------------------------------------------------------------

  const {
    data: feedsData,
    isLoading: loading,
    isRefreshing: refreshing,
    error: fetchError,
    refresh,
    mutate,
  } = useCachedData<Feed[]>({
    cacheKey: 'tbc_bookmarks',
    invalidateOn: CACHE_EVENTS.BOOKMARKS,
    fetcher: async () => {
      const response = await feedsApi.getBookmarks();

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load bookmarks');
      }

      // Bookmarks API might return different formats
      let bookmarkData: any[] = [];

      if (Array.isArray(response.data)) {
        bookmarkData = response.data;
      } else if (Array.isArray(response.data.data)) {
        bookmarkData = response.data.data;
      } else if (Array.isArray(response.data.feeds)) {
        bookmarkData = response.data.feeds;
      } else if (response.data.feeds?.data && Array.isArray(response.data.feeds.data)) {
        bookmarkData = response.data.feeds.data;
      }

      if (!Array.isArray(bookmarkData)) {
        return [];
      }

      // Extract feeds from bookmarks
      return bookmarkData.map((item: any) => {
        const feed = item.feed || item;
        return { ...feed, bookmarked: true };
      });
    },
  });

  const feeds = feedsData || [];
  const error = fetchError?.message || null;
  const setFeeds = useArrayMutate(mutate);
  
  // Shared feed actions
  const {
    handleCommentPress, handleEdit, handleDelete,
    handleAuthorPress, handleSpacePress,
  } = useFeedActions({ setFeeds, refresh });

  const handleReact = useFeedReactions(feeds, setFeeds);

  // Custom bookmark toggle — removes feed from list when unbookmarked
  const handleBookmarkToggle = async (feed: Feed, isBookmarked: boolean) => {
    try {
      const response = await optimisticUpdate(
        setFeeds,
        prev => isBookmarked
          ? prev.map(f => f.id === feed.id ? { ...f, bookmarked: isBookmarked } : f)
          : prev.filter(f => f.id !== feed.id),
        () => feedsApi.toggleBookmark(feed.id, !isBookmarked),
      );
      if (response.success) {
        cacheEvents.emit(CACHE_EVENTS.FEEDS);
      }
    } catch (err) {
      log.error('Bookmark error:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update bookmark');
    }
  };

  // ---------------------------------------------------------------------------
  // Header Component
  // ---------------------------------------------------------------------------

  const BookmarksHeader = () => (
    <View style={[styles.headerInfo, { backgroundColor: themeColors.surface }]}>
      <Ionicons name="bookmark" size={48} color={themeColors.primary} />
      <Text style={[styles.headerTitle, { color: themeColors.text }]}>Saved Posts</Text>
      <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
        {feeds.length} {feeds.length === 1 ? 'post' : 'posts'} saved
      </Text>
    </View>
  );
  
  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        {/* Header - Using PageHeader for consistency */}
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title="Bookmarks"
        />
        <FeedList
          feeds={feeds}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onRefresh={refresh}
          onReact={handleReact}
          onAuthorPress={handleAuthorPress}
          onSpacePress={handleSpacePress}
          onCommentPress={handleCommentPress}
          onBookmarkToggle={handleBookmarkToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          ListHeaderComponent={<BookmarksHeader />}
          emptyMessage="No saved posts yet. Tap the bookmark icon on any post to save it here."
          emptyIcon="book-outline"
        />
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

  headerInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginTop: spacing.md,
  },

  headerSubtitle: {
    fontSize: typography.size.md,
    marginTop: spacing.xs,
  },
});