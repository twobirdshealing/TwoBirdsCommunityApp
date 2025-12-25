// =============================================================================
// SPACE PAGE - Individual space view with feeds
// =============================================================================
// FIXED: 
// - Header padding matches TopHeader (uses useSafeAreaInsets properly)
// - Stats read from correct fields (members_count, posts_count/feeds_count)
// - SpaceMenu in header
// - Sticky posts, bookmark, edit, delete, PIN support
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
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
        // BULLETPROOF: sticky can be null, undefined, object, or array
        let stickyPosts: Feed[] = [];
        const rawSticky = response.data.sticky;
        
        console.log('[FEEDS] rawSticky:', JSON.stringify(rawSticky)?.substring(0, 200));
        
        if (rawSticky) {
          if (Array.isArray(rawSticky)) {
            // It's already an array
            stickyPosts = rawSticky;
          } else if (typeof rawSticky === 'object') {
            // It might be an object with data array, or a single feed
            if (Array.isArray((rawSticky as any).data)) {
              stickyPosts = (rawSticky as any).data;
            } else if ((rawSticky as any).id) {
              // Single feed object
              stickyPosts = [rawSticky as Feed];
            } else {
              // Try to get values if it's an object like {0: feed, 1: feed}
              const values = Object.values(rawSticky);
              if (values.length > 0 && (values[0] as any)?.id) {
                stickyPosts = values as Feed[];
              }
            }
          }
        }
        
        // BULLETPROOF: feeds.data can also be missing
        let regularFeeds: Feed[] = [];
        if (response.data.feeds?.data) {
          if (Array.isArray(response.data.feeds.data)) {
            regularFeeds = response.data.feeds.data;
          } else {
            console.warn('[FEEDS] feeds.data is not an array:', typeof response.data.feeds.data);
          }
        }
        
        console.log('[FEEDS] sticky count:', stickyPosts.length, 'regular count:', regularFeeds.length);
        
        // Get total posts count from response
        const totalPosts = response.data.feeds?.total || regularFeeds.length + stickyPosts.length;
        setPostsCount(totalPosts);
        
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
      console.error('[FEEDS] Error:', err);
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
          f.id === feed.id ? { ...f, bookmarked: isBookmarked } : f
        )
      );
    } catch (err) {
      console.error('Bookmark error:', err);
      Alert.alert('Error', 'Failed to update bookmark');
    }
  };

  // ---------------------------------------------------------------------------
  // Pin Handler (for admins)
  // ---------------------------------------------------------------------------

  const handlePin = async (feed: Feed) => {
    try {
      const newStickyState = !feed.is_sticky;
      
      console.log('[PIN] Toggling sticky for feed:', {
        id: feed.id,
        title: feed.title,
        currentSticky: feed.is_sticky,
        newSticky: newStickyState,
      });
      
      // Optimistic update
      setFeeds(prevFeeds =>
        prevFeeds.map(f => 
          f.id === feed.id ? { ...f, is_sticky: newStickyState } : f
        )
      );

      // Use toggleSticky with PATCH - doesn't require message field
      const response = await feedsApi.toggleSticky(feed.id, newStickyState);
      
      console.log('[PIN] API Response:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        Alert.alert(
          newStickyState ? 'Pinned' : 'Unpinned',
          newStickyState ? 'Post pinned to top' : 'Post unpinned'
        );
        // Refresh to get correct order
        fetchFeeds(true);
      } else {
        console.error('[PIN] Failed:', response.error);
        // Revert
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
  // Stats - API doesn't return counts in space detail endpoint (bug?)
  // Docs say it should, but it doesn't. Work around:
  // - posts_count: Get from feeds API response (has total)
  // - members_count: Get from members API response (has meta.total)
  // ---------------------------------------------------------------------------

  const [membersCount, setMembersCount] = useState<number>(0);
  const [postsCount, setPostsCount] = useState<number>(0);

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
  // Custom Header (matches TopHeader padding exactly)
  // ---------------------------------------------------------------------------

  const SpacePageHeader = () => (
    <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
      <View style={styles.headerContent}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {space?.title || 'Space'}
        </Text>

        {/* Space Menu */}
        <View style={styles.headerRight}>
          {slug && (
            <SpaceMenu 
              slug={slug} 
              role={space?.role}
              onLeaveSuccess={handleLeaveSuccess}
            />
          )}
        </View>
      </View>
    </View>
  );
  
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
      {/* Custom Header - matches TopHeader padding */}
      <SpacePageHeader />
      
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
// Styles - Header matches TopHeader exactly
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header - matches TopHeader styles exactly
  headerContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },

  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },

  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginHorizontal: spacing.sm,
  },

  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  
  // Space Header (inside FeedList)
  spaceHeader: {
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  
  coverImage: {
    width: '100%',
    height: 120,
  },

  coverPlaceholder: {
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
