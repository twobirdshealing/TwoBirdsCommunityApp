// =============================================================================
// BOOKMARKS SCREEN - Shows user's saved posts
// =============================================================================

import { CommentSheet } from '@/components/feed/CommentSheet';
import { FeedList } from '@/components/feed/FeedList';
import { PageHeader } from '@/components/navigation';
import { CreatePostModal, ComposerSubmitData } from '@/components/composer';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { feedsApi } from '@/services/api';
import { Feed } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFeedReactions } from '@/hooks';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function BookmarksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  // State
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Comment sheet state
  const [showComments, setShowComments] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedFeedSlug, setSelectedFeedSlug] = useState<string | undefined>(undefined);

  // Edit state
  const [showComposer, setShowComposer] = useState(false);
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);
  
  // ---------------------------------------------------------------------------
  // Fetch Bookmarks
  // ---------------------------------------------------------------------------
  
  const fetchBookmarks = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }
      
      const response = await feedsApi.getBookmarks();

      // FIXED: Check for failure first to properly narrow the discriminated union
      if (!response.success) {
        setError(response.error?.message || 'Failed to load bookmarks');
        return;
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
        setFeeds([]);
        return;
      }
      
      // Extract feeds from bookmarks
      const feedList = bookmarkData.map((item: any) => {
        const feed = item.feed || item;
        return { ...feed, bookmarked: true };
      });
      
      setFeeds(feedList);
    } catch (err) {
      if (__DEV__) console.error('[Bookmarks] Error:', err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  // Initial load
  useEffect(() => {
    fetchBookmarks();
  }, [fetchBookmarks]);
  
  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  
  const handleRefresh = () => {
    fetchBookmarks(true);
  };
  
  const handleReact = useFeedReactions(feeds, setFeeds);
  
  const handleAuthorPress = (username: string) => {
    router.push({
      pathname: '/profile/[username]',
      params: { username },
    });
  };
  
  const handleSpacePress = (spaceSlug: string) => {
    router.push({
      pathname: '/space/[slug]',
      params: { slug: spaceSlug },
    });
  };
  
  // Comment handlers
  const handleCommentPress = (feed: Feed) => {
    setSelectedFeedId(feed.id);
    setSelectedFeedSlug(feed.slug);
    setShowComments(true);
  };
  
  const handleCloseComments = () => {
    setShowComments(false);
    setSelectedFeedId(null);
    setSelectedFeedSlug(undefined);
  };
  
  const handleCommentAdded = () => {
    fetchBookmarks(true);
  };

  // ---------------------------------------------------------------------------
  // Bookmark Toggle (Remove from bookmarks)
  // ---------------------------------------------------------------------------

  const handleBookmarkToggle = async (feed: Feed, isBookmarked: boolean) => {
    try {
      await feedsApi.toggleBookmark(feed.id, !isBookmarked);
      
      if (!isBookmarked) {
        setFeeds(prevFeeds => prevFeeds.filter(f => f.id !== feed.id));
      } else {
        setFeeds(prevFeeds =>
          prevFeeds.map(f => 
            f.id === feed.id ? { ...f, bookmarked: isBookmarked } : f
          )
        );
      }
    } catch (err) {
      if (__DEV__) console.error('Bookmark error:', err);
      Alert.alert('Error', 'Failed to update bookmark');
    }
  };

  // ---------------------------------------------------------------------------
  // Edit/Delete Handlers
  // ---------------------------------------------------------------------------

  const handleEdit = (feed: Feed) => {
    setEditingFeed(feed);
    setShowComposer(true);
  };

  const handleEditPost = async (data: ComposerSubmitData) => {
    if (!editingFeed) return;
    try {
      const response = await feedsApi.updateFeed(editingFeed.id, {
        message: data.message,
        title: data.title,
        content_type: data.content_type,
        media_images: data.media_images,
      });

      if (response.success && response.data?.feed) {
        setFeeds(prevFeeds =>
          prevFeeds.map(f => f.id === editingFeed.id
            ? { ...response.data!.feed, bookmarked: true }
            : f
          )
        );
      } else {
        throw new Error(!response.success ? response.error.message : 'Failed to update post');
      }
    } catch (err) {
      if (__DEV__) console.error('Edit post error:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to update post');
    }
  };

  const handleDelete = async (feed: Feed) => {
    try {
      const response = await feedsApi.deleteFeed(feed.id);
      
      if (response.success) {
        setFeeds(prevFeeds => prevFeeds.filter(f => f.id !== feed.id));
        Alert.alert('Deleted', 'Post deleted successfully');
      } else {
        Alert.alert('Error', response.error?.message || 'Failed to delete post');
      }
    } catch (err) {
      if (__DEV__) console.error('Delete error:', err);
      Alert.alert('Error', 'Failed to delete post');
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

      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: themeColors.background }]}>
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
          onRefresh={handleRefresh}
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
          onClose={() => {
            setShowComposer(false);
            setEditingFeed(null);
          }}
          onSubmit={handleEditPost}
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