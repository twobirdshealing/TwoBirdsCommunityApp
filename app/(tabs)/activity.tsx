// =============================================================================
// ACTIVITY SCREEN - Main community feed with post/comment creation
// =============================================================================
// Shows all posts from spaces user is a member of
// Includes QuickPostBox for creating new posts
// Clicking comment icon opens CommentSheet directly!
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
  
  // ---------------------------------------------------------------------------
  // Fetch Feeds
  // ---------------------------------------------------------------------------
  
  const fetchFeeds = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }
      
      const response = await feedsApi.getFeeds({ per_page: 20 });
      
      if (response.success) {
        setFeeds(response.data.feeds.data);
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
  // Create Post
  // ---------------------------------------------------------------------------
  
  const handleCreatePost = async (data: ComposerSubmitData) => {
    try {
      const response = await feedsApi.createFeed({
        message: data.message,
        title: data.title,
        content_type: data.content_type,
        space_id: data.space_id,
        meta: data.meta,
      });

      if (response.success) {
        // Refresh feed to show new post
        fetchFeeds(true);
        Alert.alert('Success', 'Your post has been published!');
      } else {
        throw new Error(response.error?.message || 'Failed to create post');
      }
    } catch (err) {
      console.error('Create post error:', err);
      throw err; // Re-throw to let modal handle it
    }
  };
  
  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  
  const handleRefresh = () => {
    fetchFeeds(true);
  };
  
  const handleFeedPress = (feed: Feed) => {
    router.push(`/feed/${feed.id}`);
  };
  
  // NEW: Open comment sheet directly
  const handleCommentPress = (feed: Feed) => {
    setSelectedFeedId(feed.id);
    setShowComments(true);
  };
  
  const handleCloseComments = () => {
    setShowComments(false);
    setSelectedFeedId(null);
  };
  
  const handleCommentAdded = () => {
    // Refresh feeds to update comment counts
    fetchFeeds(true);
  };
  
  const handleReact = async (feedId: number, type: 'like' | 'love') => {
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
            reactions_count: hasUserReact ? currentCount - 1 : currentCount + 1
          };
        }
        return f;
      })
    );
    
    try {
      const response = await feedsApi.reactToFeed(feedId, type, hasUserReact);
      
      if (response.success) {
        setFeeds(prevFeeds => 
          prevFeeds.map(f => 
            f.id === feedId 
              ? { ...f, reactions_count: response.data.new_count }
              : f
          )
        );
      } else {
        // Revert on error
        setFeeds(prevFeeds => 
          prevFeeds.map(f => {
            if (f.id === feedId) {
              return { ...f, has_user_react: hasUserReact };
            }
            return f;
          })
        );
      }
    } catch (err) {
      console.error('Failed to react:', err);
      fetchFeeds(true);
    }
  };
  
  const handleAuthorPress = (username: string) => {
    router.push(`/profile/${username}`);
  };
  
  const handleSpacePress = (spaceSlug: string) => {
    router.push(`/space/${spaceSlug}`);
  };
  
  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  return (
    <View style={styles.container}>
      {/* Quick Post Box */}
      <QuickPostBox
        placeholder="What's happening?"
        onPress={() => setShowComposer(true)}
      />

      {/* Feed List */}
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
        emptyMessage="No posts yet. Be the first to share!"
        emptyIcon="🐦"
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
