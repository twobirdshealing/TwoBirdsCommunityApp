// =============================================================================
// BOOKMARKS SCREEN - Shows user's saved posts
// =============================================================================

import { CommentSheet } from '@/components/feed/CommentSheet';
import { FeedList } from '@/components/feed/FeedList';
import { PageHeader } from '@/components/navigation/PageHeader';
import { CreatePostModal } from '@/components/composer/CreatePostModal';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { feedsApi } from '@/services/api/feeds';
import { Feed } from '@/types/feed';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedReactions } from '@/hooks/useFeedReactions';
import { useCachedData } from '@/hooks/useCachedData';
import { useFeedActions } from '@/hooks/useFeedActions';

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

  // Adapter: wraps mutate to match React.Dispatch<SetStateAction<Feed[]>> signature
  const setFeeds: React.Dispatch<React.SetStateAction<Feed[]>> = useCallback(
    (action) => {
      mutate(prev => {
        const current = prev || [];
        return typeof action === 'function' ? action(current) : action;
      });
    },
    [mutate],
  );
  
  // Shared feed actions
  const {
    showComments, selectedFeedId, selectedFeedSlug,
    handleCommentPress, handleCloseComments, handleCommentAdded,
    showComposer, editingFeed, handleEdit, closeComposer,
    handleCreateOrEditPost, handleDelete,
    handleAuthorPress, handleSpacePress,
  } = useFeedActions({ setFeeds, refresh });

  const handleReact = useFeedReactions(feeds, setFeeds);

  // Custom bookmark toggle — removes feed from list when unbookmarked
  const handleBookmarkToggle = async (feed: Feed, isBookmarked: boolean) => {
    try {
      await feedsApi.toggleBookmark(feed.id, !isBookmarked);
      if (!isBookmarked) {
        setFeeds(prev => prev.filter(f => f.id !== feed.id));
      } else {
        setFeeds(prev =>
          prev.map(f => f.id === feed.id ? { ...f, bookmarked: isBookmarked } : f)
        );
      }
    } catch (err) {
      if (__DEV__) console.error('Bookmark error:', err);
      Alert.alert('Error', 'Failed to update bookmark');
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
        
        {/* Edit Post Modal */}
        <CreatePostModal
          visible={showComposer}
          onClose={closeComposer}
          onSubmit={handleCreateOrEditPost}
          editFeed={editingFeed || undefined}
        />

        {/* Comment Sheet */}
        <CommentSheet
          visible={showComments}
          postId={selectedFeedId}
          feedSlug={selectedFeedSlug}
          onClose={handleCloseComments}
          onCommentAdded={handleCommentAdded}
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
    fontWeight: '700',
    marginTop: spacing.md,
  },

  headerSubtitle: {
    fontSize: typography.size.md,
    marginTop: spacing.xs,
  },
});