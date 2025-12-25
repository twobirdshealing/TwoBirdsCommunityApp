// =============================================================================
// BOOKMARKS SCREEN - Shows user's saved posts
// =============================================================================
// Accessible from avatar dropdown menu
// Uses GET /feeds/bookmarks endpoint
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { Feed } from '@/types';
import { feedsApi } from '@/services/api';
import { FeedList } from '@/components/feed/FeedList';
import { CommentSheet } from '@/components/feed/CommentSheet';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function BookmarksScreen() {
  const router = useRouter();
  
  // State
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Comment sheet state
  const [showComments, setShowComments] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedFeedSlug, setSelectedFeedSlug] = useState<string | undefined>(undefined);
  
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
      
      console.log('[BOOKMARKS] Raw response:', JSON.stringify(response, null, 2).substring(0, 500));
      
      if (response.success && response.data) {
        // Bookmarks API might return different formats
        // Try: response.data.data, response.data.feeds, response.data directly
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
        
        console.log('[BOOKMARKS] Extracted data count:', bookmarkData.length);
        
        // BULLETPROOF: Make sure it's an array before mapping
        if (!Array.isArray(bookmarkData)) {
          console.warn('[BOOKMARKS] bookmarkData is not an array:', typeof bookmarkData);
          setFeeds([]);
          return;
        }
        
        // Extract feeds from bookmarks (handle both formats)
        const feedList = bookmarkData.map((item: any) => {
          // If item has a feed property, use it; otherwise assume item IS the feed
          const feed = item.feed || item;
          // Mark as bookmarked
          return { ...feed, bookmarked: true };
        });
        
        console.log('[BOOKMARKS] Final feed count:', feedList.length);
        setFeeds(feedList);
      } else {
        setError(response.error?.message || 'Failed to load bookmarks');
      }
    } catch (err) {
      console.error('[BOOKMARKS] Error:', err);
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
  
  const handleFeedPress = (feed: Feed) => {
    router.push({
      pathname: '/feed/[id]',
      params: { id: feed.id.toString() },
    });
  };
  
  const handleReact = async (feedId: number, type: 'like') => {
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return;
    
    const hasUserReact = feed.has_user_react || false;

    // Optimistic update
    setFeeds(prevFeeds =>
      prevFeeds.map(f => {
        if (f.id === feedId) {
          const currentCount = typeof f.reactions_count === 'string'
            ? parseInt(f.reactions_count, 10)
            : f.reactions_count || 0;
          
          return {
            ...f,
            has_user_react: !hasUserReact,
            reactions_count: hasUserReact ? currentCount - 1 : currentCount + 1,
          };
        }
        return f;
      })
    );

    try {
      await feedsApi.reactToFeed(feedId, type, hasUserReact);
    } catch (err) {
      // Revert on error
      setFeeds(prevFeeds =>
        prevFeeds.map(f => (f.id === feedId ? feed : f))
      );
    }
  };
  
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
      // When toggled OFF, remove from bookmarks
      await feedsApi.toggleBookmark(feed.id, !isBookmarked);
      
      if (!isBookmarked) {
        // Removed bookmark - remove from list
        setFeeds(prevFeeds => prevFeeds.filter(f => f.id !== feed.id));
      } else {
        // Re-added bookmark (shouldn't happen in this screen but handle it)
        setFeeds(prevFeeds =>
          prevFeeds.map(f => 
            f.id === feed.id ? { ...f, bookmarked: isBookmarked } : f
          )
        );
      }
    } catch (err) {
      console.error('Bookmark error:', err);
      Alert.alert('Error', 'Failed to update bookmark');
    }
  };

  // ---------------------------------------------------------------------------
  // Edit/Delete Handlers
  // ---------------------------------------------------------------------------

  const handleEdit = (feed: Feed) => {
    Alert.alert(
      'Edit Post',
      'Edit functionality coming soon!',
      [{ text: 'OK' }]
    );
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
      console.error('Delete error:', err);
      Alert.alert('Error', 'Failed to delete post');
    }
  };

  // ---------------------------------------------------------------------------
  // Header Component
  // ---------------------------------------------------------------------------

  const BookmarksHeader = () => (
    <View style={styles.headerInfo}>
      <Ionicons name="bookmark" size={48} color={colors.primary} />
      <Text style={styles.headerTitle}>Saved Posts</Text>
      <Text style={styles.headerSubtitle}>
        {feeds.length} {feeds.length === 1 ? 'post' : 'posts'} saved
      </Text>
    </View>
  );
  
  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  return (
    <>
      <Stack.Screen
        options={{
          title: 'Bookmarks',
          headerBackTitle: 'Back',
        }}
      />
      
      <View style={styles.container}>
        <FeedList
          feeds={feeds}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onRefresh={handleRefresh}
          onFeedPress={handleFeedPress}
          onReact={handleReact}
          onAuthorPress={handleAuthorPress}
          onSpacePress={handleSpacePress}
          onCommentPress={handleCommentPress}
          onBookmarkToggle={handleBookmarkToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          ListHeaderComponent={<BookmarksHeader />}
          emptyMessage="No saved posts yet. Tap the bookmark icon on any post to save it here."
          emptyIcon="🔖"
        />
        
        {/* Comment Sheet */}
        <CommentSheet
          visible={showComments}
          feedId={selectedFeedId}
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
    backgroundColor: colors.background,
  },

  headerInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },

  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
  },

  headerSubtitle: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
