// =============================================================================
// ACTIVITY SCREEN - Main community feed with all features
// =============================================================================
// UPDATED: Added Welcome Banner support
// UPDATED: Added pin support for admins
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Feed, WelcomeBanner as WelcomeBannerType } from '@/types';
import { feedsApi } from '@/services/api';
import { FeedList } from '@/components/feed/FeedList';
import { WelcomeBanner } from '@/components/feed/WelcomeBanner';
import { CommentSheet } from '@/components/feed/CommentSheet';
import { QuickPostBox, CreatePostModal, ComposerSubmitData } from '@/components/composer';
import { useAuth } from '@/contexts/AuthContext';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ActivityScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  // Feed state
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Welcome banner state
  const [welcomeBanner, setWelcomeBanner] = useState<WelcomeBannerType | null>(null);
  
  // Modal states
  const [showComposer, setShowComposer] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedFeedSlug, setSelectedFeedSlug] = useState<string | undefined>(undefined);
  
  // ---------------------------------------------------------------------------
  // Fetch Welcome Banner
  // ---------------------------------------------------------------------------
  
  const fetchWelcomeBanner = useCallback(async () => {
    try {
      const response = await feedsApi.getWelcomeBanner();
      
      if (response.success && response.data?.welcome_banner) {
        setWelcomeBanner(response.data.welcome_banner);
      }
    } catch (err) {
      // Silent fail - banner is optional
      console.log('[BANNER] Failed to fetch welcome banner:', err);
    }
  }, []);
  
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
      
      if (response.success && response.data) {
        // BULLETPROOF: sticky can be null, undefined, object, or array
        let stickyPosts: Feed[] = [];
        const rawSticky = response.data.sticky;
        
        if (rawSticky) {
          if (Array.isArray(rawSticky)) {
            stickyPosts = rawSticky;
          } else if (typeof rawSticky === 'object') {
            // Handle object format
            if (Array.isArray((rawSticky as any).data)) {
              stickyPosts = (rawSticky as any).data;
            } else if ((rawSticky as any).id) {
              stickyPosts = [rawSticky as Feed];
            } else {
              const values = Object.values(rawSticky);
              if (values.length > 0 && (values[0] as any)?.id) {
                stickyPosts = values as Feed[];
              }
            }
          }
        }
        
        // BULLETPROOF: feeds.data can also be missing
        let regularFeeds: Feed[] = [];
        if (response.data.feeds?.data && Array.isArray(response.data.feeds.data)) {
          regularFeeds = response.data.feeds.data;
        }
        
        // Remove duplicates (sticky might also appear in regular feeds)
        const stickyIds = new Set(stickyPosts.map(f => f.id));
        const filteredRegular = regularFeeds.filter(f => !stickyIds.has(f.id));
        
        // Ensure sticky posts are marked
        const markedSticky = stickyPosts.map(f => ({ ...f, is_sticky: true }));
        
        setFeeds([...markedSticky, ...filteredRegular]);
      } else {
        setError(response.error?.message || 'Failed to load feeds');
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
    fetchWelcomeBanner();
    fetchFeeds();
  }, [fetchWelcomeBanner, fetchFeeds]);
  
  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  
  const handleRefresh = () => {
    fetchWelcomeBanner(); // Also refresh banner
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
  // Pin Handler (for admins - on activity feed, user must be admin of the space)
  // ---------------------------------------------------------------------------

  const handlePin = async (feed: Feed) => {
    // On activity feed, we can only pin if user owns the post
    // (Space-level admin pinning is handled in space page)
    if (Number(feed.user_id) !== user?.id) {
      Alert.alert('Cannot Pin', 'You can only pin your own posts from this view. Go to the space to pin other posts.');
      return;
    }

    try {
      const newStickyState = !feed.is_sticky;
      
      // Optimistic update
      setFeeds(prevFeeds =>
        prevFeeds.map(f => 
          f.id === feed.id ? { ...f, is_sticky: newStickyState } : f
        )
      );

      // Use toggleSticky with PATCH - doesn't require message field
      const response = await feedsApi.toggleSticky(feed.id, newStickyState);
      
      if (response.success) {
        Alert.alert(
          newStickyState ? 'Pinned' : 'Unpinned',
          newStickyState ? 'Post pinned to top!' : 'Post unpinned'
        );
        // Refresh to get proper order
        fetchFeeds(true);
      } else {
        // Revert
        setFeeds(prevFeeds =>
          prevFeeds.map(f => 
            f.id === feed.id ? { ...f, is_sticky: !newStickyState } : f
          )
        );
        Alert.alert('Error', response.error?.message || 'Failed to update pin status');
      }
    } catch (err) {
      console.error('Pin error:', err);
      Alert.alert('Error', 'Failed to update pin status');
    }
  };

  // ---------------------------------------------------------------------------
  // Edit & Delete Handlers
  // ---------------------------------------------------------------------------

  const handleEdit = (feed: Feed) => {
    Alert.alert(
      'Edit Post',
      'Edit functionality coming soon!',
      [{ text: 'OK' }]
    );
  };

  const handleDelete = async (feed: Feed) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
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
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Create Post Handler
  // ---------------------------------------------------------------------------

  const handleCreatePost = async (data: ComposerSubmitData) => {
    try {
      const response = await feedsApi.createFeed({
        message: data.message,
        title: data.title,
        space: data.space,
        content_type: data.content_type,
        media_images: data.media_images,
      });
      
      if (response.success && response.data?.data) {
        // Add new post to top of feed
        setFeeds(prevFeeds => [response.data!.data, ...prevFeeds]);
      } else {
        throw new Error(response.error?.message || 'Failed to create post');
      }
    } catch (err) {
      console.error('Create post error:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to create post');
    }
  };

  // ---------------------------------------------------------------------------
  // Header Component with Welcome Banner
  // ---------------------------------------------------------------------------

  const FeedHeader = () => (
    <>
      {/* Welcome Banner - shown above QuickPostBox */}
      {welcomeBanner && welcomeBanner.enabled === 'yes' && (
        <WelcomeBanner banner={welcomeBanner} />
      )}
      
      {/* Quick Post Box */}
      <QuickPostBox
        onPress={() => setShowComposer(true)}
      />
    </>
  );
  
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
        // Note: On activity feed, pin only shows for own posts
        // Space admins should go to the space to pin others' posts
        ListHeaderComponent={<FeedHeader />}
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
