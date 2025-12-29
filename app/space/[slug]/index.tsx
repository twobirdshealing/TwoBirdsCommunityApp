// =============================================================================
// SPACE PAGE - Individual space view with feeds
// =============================================================================
// FIXED: 
// - Uses PageHeader component for consistent styling
// - Stats read from correct fields (members_count, posts_count/feeds_count)
// - SpaceMenu in header
// - Sticky posts, bookmark, edit, delete, PIN support
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { Feed, Space } from '@/types';
import { feedsApi, spacesApi } from '@/services/api';
import { FeedList } from '@/components/feed/FeedList';
import { CommentSheet } from '@/components/feed/CommentSheet';
import { SpaceMenu } from '@/components/space/SpaceMenu';
import { PageHeader } from '@/components/navigation';
import { QuickPostBox, CreatePostModal, ComposerSubmitData } from '@/components/composer';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SpacePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
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
  
  // Stats - API doesn't return counts reliably
  const [membersCount, setMembersCount] = useState<number>(0);
  const [postsCount, setPostsCount] = useState<number>(0);
  
  // ---------------------------------------------------------------------------
  // Fetch Space Data
  // ---------------------------------------------------------------------------
  
  const fetchSpace = useCallback(async () => {
    if (!slug) return;
    
    try {
      const response = await spacesApi.getSpaceBySlug(slug);
      console.log('[SPACE DEBUG] Raw API response:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        // API returns { data: { space: Space } } or { data: Space }
        const spaceData = response.data.space || response.data;
        console.log('[SPACE DEBUG] Extracted space data:', JSON.stringify(spaceData, null, 2));
        setSpace(spaceData);
        
        // Check if counts are in response (docs say they should be!)
        if (spaceData.members_count) {
          setMembersCount(spaceData.members_count);
        }
        if (spaceData.posts_count) {
          setPostsCount(spaceData.posts_count);
        }
      }
      
      // Also fetch members count (since API doesn't return it reliably)
      try {
        const membersResponse = await spacesApi.getSpaceMembers(slug, { per_page: 1 });
        if (membersResponse.success && membersResponse.data?.meta?.total) {
          setMembersCount(membersResponse.data.meta.total);
        }
      } catch (err) {
        console.log('[STATS] Could not fetch members count');
      }
      
    } catch (err) {
      console.error('Failed to load space:', err);
    }
  }, [slug]);
  
  // ---------------------------------------------------------------------------
  // Fetch Feeds - Merges sticky posts at top
  // ---------------------------------------------------------------------------
  
  const fetchFeeds = useCallback(async (isRefresh = false) => {
    if (!slug) return;
    
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }
      
      const response = await feedsApi.getFeeds({ space: slug, per_page: 20 });
      console.log('[FEEDS] Raw response type:', typeof response.data);
      
      if (response.success && response.data) {
        // Handle the response structure
        let feedsData: Feed[] = [];
        
        if (response.data.feeds?.data) {
          feedsData = response.data.feeds.data;
        } else if (Array.isArray(response.data.feeds)) {
          feedsData = response.data.feeds;
        } else if (Array.isArray(response.data)) {
          feedsData = response.data;
        }
        
        // Sort: sticky first, then by date
        const sortedFeeds = [...feedsData].sort((a, b) => {
          if (a.is_sticky && !b.is_sticky) return -1;
          if (!a.is_sticky && b.is_sticky) return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        
        setFeeds(sortedFeeds);
        
        // Update posts count from meta if available
        if (response.data.feeds?.total) {
          setPostsCount(response.data.feeds.total);
        }
      }
    } catch (err) {
      console.error('Fetch feeds error:', err);
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
  // Navigation Handlers
  // ---------------------------------------------------------------------------
  
  const handleRefresh = () => {
    fetchSpace(); // Also refresh space stats
    fetchFeeds(true);
  };
  
  const handleFeedPress = (feed: Feed) => {
    router.push({
      pathname: '/feed/[id]',
      params: { id: feed.id.toString(), space: slug },
    });
  };
  
  const handleAuthorPress = (username: string) => {
    router.push({
      pathname: '/profile/[username]',
      params: { username },
    });
  };

  // ---------------------------------------------------------------------------
  // Reaction Handler
  // ---------------------------------------------------------------------------
  
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
  
  // ---------------------------------------------------------------------------
  // Comment Handlers
  // ---------------------------------------------------------------------------
  
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
  // Bookmark Handler
  // ---------------------------------------------------------------------------

  const handleBookmarkToggle = async (feed: Feed, isBookmarked: boolean) => {
    try {
      await feedsApi.toggleBookmark(feed.id, !isBookmarked);
      
      setFeeds(prevFeeds =>
        prevFeeds.map(f => 
          f.id === feed.id 
            ? { ...f, is_bookmarked: !isBookmarked } 
            : f
        )
      );
    } catch (err) {
      console.error('Bookmark toggle error:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // Pin Handler
  // ---------------------------------------------------------------------------

  const handlePin = async (feed: Feed) => {
    const newStickyState = !feed.is_sticky;
    
    console.log('[PIN] Toggling sticky for feed:', feed.id, '-> sticky:', newStickyState);
    
    // Optimistic update
    setFeeds(prevFeeds => {
      const updated = prevFeeds.map(f =>
        f.id === feed.id ? { ...f, is_sticky: newStickyState } : f
      );
      
      // Re-sort: sticky first
      return updated.sort((a, b) => {
        if (a.is_sticky && !b.is_sticky) return -1;
        if (!a.is_sticky && b.is_sticky) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
    
    try {
      const response = await feedsApi.toggleSticky(feed.id, newStickyState);
      
      console.log('[PIN] API response:', response);
      
      if (!response.success) {
        // Revert on error
        setFeeds(prevFeeds =>
          prevFeeds.map(f =>
            f.id === feed.id ? { ...f, is_sticky: !newStickyState } : f
          )
        );
        Alert.alert('Error', response.error?.message || 'Failed to update pin');
      }
    } catch (err) {
      console.error('[PIN] Exception:', err);
      Alert.alert('Error', 'Failed to pin post');
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
  // Create Post Handler
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
  // Leave Space Handler (for SpaceMenu)
  // ---------------------------------------------------------------------------

  const handleLeaveSuccess = () => {
    Alert.alert('Left Space', 'You have left this space.');
  };

  // ---------------------------------------------------------------------------
  // Check if user can pin (admin/moderator of space)
  // ---------------------------------------------------------------------------

  const canPin = () => {
    if (!space) {
      console.log('[PIN DEBUG] No space loaded yet');
      return false;
    }
    
    // API returns role in membership.pivot.role
    // AND permissions object with community_admin, community_moderator, edit_any_feed
    const membershipRole = (space as any).membership?.pivot?.role;
    const permissions = (space as any).permissions;
    
    console.log('[PIN DEBUG] membershipRole:', membershipRole);
    console.log('[PIN DEBUG] permissions:', permissions ? {
      community_admin: permissions.community_admin,
      community_moderator: permissions.community_moderator,
      edit_any_feed: permissions.edit_any_feed,
    } : 'none');
    
    // Check if user has admin/mod role OR has edit_any_feed permission
    const hasRole = membershipRole === 'admin' || membershipRole === 'moderator';
    const hasPermission = permissions?.community_admin || 
                          permissions?.community_moderator || 
                          permissions?.edit_any_feed;
    
    const result = hasRole || hasPermission;
    console.log('[PIN DEBUG] canPin result:', result, '(hasRole:', hasRole, ', hasPermission:', hasPermission, ')');
    
    return result;
  };

  // ---------------------------------------------------------------------------
  // Space Info Header (inside FeedList)
  // ---------------------------------------------------------------------------
  
  const SpaceInfoHeader = () => {
    if (!space) return null;
    
    return (
      <View style={styles.spaceHeader}>
        {/* Cover Image */}
        {space.cover_photo ? (
          <Image
            source={{ uri: space.cover_photo }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.coverImage, styles.coverPlaceholder]} />
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
              <Text style={styles.statText}>{membersCount} members</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="document-text-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.statText}>{postsCount} posts</Text>
            </View>
          </View>
        </View>
        
        {/* Quick Post Box */}
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

  // Debug: Log canPin result on each render
  const canPinResult = canPin();
  console.log('[SPACE PAGE RENDER] canPin():', canPinResult);
  
  return (
    <View style={styles.container}>
      {/* Header - Using PageHeader with SpaceMenu */}
      <View style={{ paddingTop: insets.top }}>
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title={space?.title || 'Space'}
          rightElement={
            slug ? (
              <SpaceMenu 
                slug={slug} 
                role={space?.role}
                onLeaveSuccess={handleLeaveSuccess}
              />
            ) : undefined
          }
        />
      </View>
      
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
        onCommentPress={handleCommentPress}
        onBookmarkToggle={handleBookmarkToggle}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPin={canPinResult ? handlePin : undefined}
        ListHeaderComponent={<SpaceInfoHeader />}
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
  );
}

// -----------------------------------------------------------------------------
// Styles (header styles removed - now in PageHeader component)
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Space Header (inside FeedList)
  spaceHeader: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  
  coverImage: {
    width: '100%',
    height: 150,
    backgroundColor: colors.skeleton,
  },
  
  coverPlaceholder: {
    backgroundColor: colors.primary,
  },
  
  spaceInfo: {
    padding: spacing.md,
  },
  
  spaceLogo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginTop: -32,
    marginBottom: spacing.sm,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.skeleton,
  },
  
  spaceTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  
  spaceDescription: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    lineHeight: typography.size.md * 1.4,
    marginBottom: spacing.sm,
  },
  
  spaceStats: {
    flexDirection: 'row',
    gap: spacing.lg,
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
