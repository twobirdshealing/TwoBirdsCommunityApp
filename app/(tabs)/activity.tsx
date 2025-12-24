// =============================================================================
// ACTIVITY SCREEN - Main community feed with all features
// =============================================================================
// UPDATED: Sticky posts merged at top, bookmark toggle, edit/delete support
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Feed } from '@/types';
import { feedsApi } from '@/services/api';
import { FeedList } from '@/components/feed/FeedList';
import { CommentSheet } from '@/components/feed/CommentSheet';
import { QuickPostBox, CreatePostModal, ComposerSubmitData } from '@/components/composer';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ActivityScreen() {
  const router = useRouter();
  
  // Feed state
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showComposer, setShowComposer] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedFeedSlug, setSelectedFeedSlug] = useState<string | undefined>(undefined);
  
  // ---------------------------------------------------------------------------
  // Fetch Feeds - Now merges sticky posts at top!
  // ---------------------------------------------------------------------------
  
  const fetchFeeds = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }
      
      const response = await feedsApi.getFeeds({ per_page: 20 });
      
      if (response.success) {
        // Merge sticky posts at top of feed!
        const stickyPosts = response.data.sticky || [];
        const regularFeeds = response.data.feeds.data || [];
        
        // Remove duplicates (sticky might also appear in regular feeds)
        const stickyIds = new Set(stickyPosts.map(f => f.id));
        const filteredRegular = regularFeeds.filter(f => !stickyIds.has(f.id));
        
        setFeeds([...stickyPosts, ...filteredRegular]);
      } else {
        setError(response.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  // Initial load
  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);
  
  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  
  const handleRefresh = () => {
    fetchFeeds(true);
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
  
  // Open comment sheet
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
    // Refresh to update comment count
    fetchFeeds(true);
  };

  // ---------------------------------------------------------------------------
  // Bookmark Toggle
  // ---------------------------------------------------------------------------

  const handleBookmarkToggle = async (feed: Feed, isBookmarked: boolean) => {
    try {
      await feedsApi.toggleBookmark(feed.id, !isBookmarked);
      
      // Update local state
      setFeeds(prevFeeds =>
        prevFeeds.map(f => 
          f.id === feed.id ? { ...f, bookmarked: isBookmarked } : f
        )
      );
    } catch (err) {
      console.error('Bookmark error:', err);
      Alert.alert('Error', 'Failed to update bookmark');
    }
  };

  // ---------------------------------------------------------------------------
  // Edit Feed
  // ---------------------------------------------------------------------------

  const handleEdit = (feed: Feed) => {
    // For now, show alert - could open edit modal later
    Alert.alert(
      'Edit Post',
      'Edit functionality coming soon!',
      [{ text: 'OK' }]
    );
    // TODO: Implement edit modal or navigate to edit screen
  };

  // ---------------------------------------------------------------------------
  // Delete Feed
  // ---------------------------------------------------------------------------

  const handleDelete = async (feed: Feed) => {
    try {
      const response = await feedsApi.deleteFeed(feed.id);
      
      if (response.success) {
        // Remove from local state
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
  // Create Post
  // ---------------------------------------------------------------------------
  
  const handleCreatePost = async (data: ComposerSubmitData) => {
    try {
      const response = await feedsApi.createFeed({
        message: data.message,
        space: data.space,
        content_type: data.content_type,
        media_images: data.media_images,
      });
      
      if (response.success) {
        setShowComposer(false);
        fetchFeeds(true);
      } else {
        Alert.alert('Error', response.error?.message || 'Failed to create post');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create post');
    }
  };
  
  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  return (
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
        ListHeaderComponent={
          <QuickPostBox
            onPress={() => setShowComposer(true)}
          />
        }
      />
      
      {/* Create Post Modal */}
      <CreatePostModal
        visible={showComposer}
        onClose={() => setShowComposer(false)}
        onSubmit={handleCreatePost}
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
});
