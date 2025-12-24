// =============================================================================
// SPACE PAGE - Individual space view with feeds
// =============================================================================
// UPDATED: Sticky posts, bookmark, edit/delete support
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { Feed, Space } from '@/types';
import { feedsApi, spacesApi } from '@/services/api';
import { FeedList } from '@/components/feed/FeedList';
import { CommentSheet } from '@/components/feed/CommentSheet';
import { QuickPostBox, CreatePostModal, ComposerSubmitData } from '@/components/composer';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SpacePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  
  // Space state
  const [space, setSpace] = useState<Space | null>(null);
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
  // Fetch Space Data
  // ---------------------------------------------------------------------------
  
  const fetchSpace = useCallback(async () => {
    if (!slug) return;
    
    try {
      const response = await spacesApi.getSpaceBySlug(slug);
      if (response.success) {
        setSpace(response.data.space);
      }
    } catch (err) {
      console.error('Failed to load space:', err);
    }
  }, [slug]);
  
  // ---------------------------------------------------------------------------
  // Fetch Feeds - Now merges sticky posts at top!
  // ---------------------------------------------------------------------------
  
  const fetchFeeds = useCallback(async (isRefresh = false) => {
    if (!slug) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }
      
      const response = await feedsApi.getFeeds({ space: slug, per_page: 20 });
      
      if (response.success) {
        // Merge sticky posts at top!
        const stickyPosts = response.data.sticky || [];
        const regularFeeds = response.data.feeds.data || [];
        
        // Remove duplicates
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
  }, [slug]);
  
  // Initial load
  useEffect(() => {
    fetchSpace();
    fetchFeeds();
  }, [fetchSpace, fetchFeeds]);
  
  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  
  const handleRefresh = () => {
    fetchFeeds(true);
  };
  
  const handleFeedPress = (feed: Feed) => {
    router.push({
      pathname: '/feed/[id]',
      params: { id: feed.id.toString(), space: slug },
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
    fetchFeeds(true);
  };

  // ---------------------------------------------------------------------------
  // Bookmark Toggle
  // ---------------------------------------------------------------------------

  const handleBookmarkToggle = async (feed: Feed, isBookmarked: boolean) => {
    try {
      await feedsApi.toggleBookmark(feed.id, !isBookmarked);
      
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
    Alert.alert(
      'Edit Post',
      'Edit functionality coming soon!',
      [{ text: 'OK' }]
    );
  };

  // ---------------------------------------------------------------------------
  // Delete Feed
  // ---------------------------------------------------------------------------

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
  // Create Post
  // ---------------------------------------------------------------------------
  
  const handleCreatePost = async (data: ComposerSubmitData) => {
    try {
      const response = await feedsApi.createFeed({
        message: data.message,
        space: data.space || slug,
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
  // Space Header Component
  // ---------------------------------------------------------------------------
  
  const SpaceHeader = () => {
    if (!space) return null;
    
    return (
      <View style={styles.spaceHeader}>
        {/* Cover Image */}
        {space.cover_photo && (
          <Image
            source={{ uri: space.cover_photo }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        )}
        
        {/* Space Info */}
        <View style={styles.spaceInfo}>
          {space.logo && (
            <Image
              source={{ uri: space.logo }}
              style={styles.spaceLogo}
              resizeMode="cover"
            />
          )}
          
          <Text style={styles.spaceTitle}>{space.title}</Text>
          
          {space.description && (
            <Text style={styles.spaceDescription} numberOfLines={2}>
              {space.description}
            </Text>
          )}
          
          <View style={styles.spaceStats}>
            <View style={styles.statItem}>
              <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.statText}>{space.members_count || 0} members</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.statText}>{space.feeds_count || 0} posts</Text>
            </View>
          </View>
        </View>
        
        {/* Quick Post Box - Always show for spaces */}
        <QuickPostBox
          onPress={() => setShowComposer(true)}
          placeholder={`Post in ${space.title}...`}
        />
      </View>
    );
  };
  
  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  return (
    <>
      <Stack.Screen
        options={{
          title: space?.title || 'Space',
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
          onCommentPress={handleCommentPress}
          onBookmarkToggle={handleBookmarkToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          ListHeaderComponent={<SpaceHeader />}
          emptyMessage="No posts in this space yet"
          emptyIcon="📝"
        />
        
        {/* Create Post Modal */}
        <CreatePostModal
          visible={showComposer}
          onClose={() => setShowComposer(false)}
          onSubmit={handleCreatePost}
          spaceSlug={slug}
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
  
  spaceHeader: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  
  coverImage: {
    width: '100%',
    height: 120,
    backgroundColor: colors.primary,
  },
  
  spaceInfo: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  
  spaceLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginTop: -40,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.background,
  },
  
  spaceTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  
  spaceDescription: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  
  spaceStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  
  statText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});
