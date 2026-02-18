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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Feed, Space } from '@/types';
import { feedsApi, spacesApi } from '@/services/api';
import { FeedList } from '@/components/feed/FeedList';
import { CommentSheet } from '@/components/feed/CommentSheet';
import { SpaceMenu } from '@/components/space/SpaceMenu';
import { PageHeader } from '@/components/navigation';
import { QuickPostBox, CreatePostModal, ComposerSubmitData } from '@/components/composer';
import { useFeedReactions } from '@/hooks';
import { stripHtmlPreserveBreaks } from '@/utils/htmlToText';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SpacePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
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
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);
  
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
        const total = membersResponse.data?.members?.total
          || membersResponse.data?.meta?.total;
        if (membersResponse.success && total) {
          setMembersCount(total);
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
  
  const handleAuthorPress = (username: string) => {
    router.push({
      pathname: '/profile/[username]',
      params: { username },
    });
  };

  const handleReact = useFeedReactions(feeds, setFeeds);
  
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
    setEditingFeed(feed);
    setShowComposer(true);
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
  // Create/Edit Post Handler
  // ---------------------------------------------------------------------------

  const handleCreateOrEditPost = async (data: ComposerSubmitData) => {
    try {
      if (editingFeed) {
        // EDIT MODE
        const response = await feedsApi.updateFeed(editingFeed.id, {
          message: data.message,
          title: data.title,
          content_type: data.content_type,
          media_images: data.media_images,
        });

        if (response.success && response.data?.feed) {
          setFeeds(prevFeeds =>
            prevFeeds.map(f => f.id === editingFeed.id ? response.data!.feed : f)
          );
        } else {
          throw new Error(response.error?.message || 'Failed to update post');
        }
      } else {
        // CREATE MODE
        const response = await feedsApi.createFeed({
          message: data.message,
          space: data.space || slug,
          content_type: data.content_type,
          media_images: data.media_images,
        });

        if (response.success) {
          fetchFeeds(true);
        } else {
          Alert.alert('Error', response.error?.message || 'Failed to create post');
        }
      }
    } catch (err) {
      console.error(`${editingFeed ? 'Edit' : 'Create'} post error:`, err);
      throw new Error(err instanceof Error ? err.message : `Failed to ${editingFeed ? 'update' : 'create'} post`);
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
  
  const getPrivacyIcon = (privacy: string): string => {
    switch (privacy) {
      case 'public': return 'globe-outline';
      case 'private': return 'lock-closed-outline';
      case 'secret': return 'eye-off-outline';
      default: return 'globe-outline';
    }
  };

  const SpaceInfoHeader = () => {
    if (!space) return null;

    const descriptionText = stripHtmlPreserveBreaks(
      (space as any).description_rendered || space.description
    );

    return (
      <View style={styles.spaceHeader}>
        {/* Hero Cover Section */}
        <View style={styles.heroContainer}>
          {space.cover_photo ? (
            <Image
              source={{ uri: space.cover_photo }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={['#6366f1', '#8b5cf6', '#d946ef']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.coverImage}
            />
          )}

          {/* Gradient Overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.heroOverlay}
          >
            {/* Logo + Title + Stats overlaid on cover */}
            <View style={styles.heroContent}>
              {space.logo && (
                <Image
                  source={{ uri: space.logo }}
                  style={styles.heroLogo}
                  resizeMode="cover"
                />
              )}
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle} numberOfLines={2}>{space.title}</Text>
                <View style={styles.heroStats}>
                  <View style={styles.heroStatItem}>
                    <Ionicons name={getPrivacyIcon(space.privacy)} size={14} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.heroStatText}>
                      {space.privacy.charAt(0).toUpperCase() + space.privacy.slice(1)}
                    </Text>
                  </View>
                  <View style={styles.heroStatDot} />
                  <View style={styles.heroStatItem}>
                    <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.heroStatText}>{membersCount}</Text>
                  </View>
                  <View style={styles.heroStatDot} />
                  <View style={styles.heroStatItem}>
                    <Ionicons name="document-text-outline" size={14} color="rgba(255,255,255,0.85)" />
                    <Text style={styles.heroStatText}>{postsCount}</Text>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Description (below cover, respects theme) */}
        {descriptionText ? (
          <View style={styles.descriptionContainer}>
            <Text style={[styles.spaceDescription, { color: themeColors.textSecondary }]} numberOfLines={3}>
              {descriptionText}
            </Text>
          </View>
        ) : null}

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
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
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
        onReact={handleReact}
        onAuthorPress={handleAuthorPress}
        onCommentPress={handleCommentPress}
        onBookmarkToggle={handleBookmarkToggle}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onPin={canPinResult ? handlePin : undefined}
        canModerate={canPinResult}
        ListHeaderComponent={<SpaceInfoHeader />}
        emptyMessage="No posts in this space yet"
        emptyIcon="📝"
      />
      
      {/* Create/Edit Post Modal */}
      <CreatePostModal
        visible={showComposer}
        onClose={() => {
          setShowComposer(false);
          setEditingFeed(null);
        }}
        onSubmit={handleCreateOrEditPost}
        spaceSlug={slug}
        editFeed={editingFeed || undefined}
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
  },

  // Space Header (inside FeedList)
  spaceHeader: {
    marginBottom: spacing.md,
  },

  // Hero Cover
  heroContainer: {
    height: 200,
    position: 'relative',
  },

  coverImage: {
    width: '100%',
    height: '100%',
  },

  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },

  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },

  heroLogo: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    marginRight: spacing.sm,
  },

  heroTextContainer: {
    flex: 1,
  },

  heroTitle: {
    fontSize: typography.size.xl,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  heroStatText: {
    fontSize: typography.size.sm,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },

  heroStatDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 8,
  },

  // Description (below cover)
  descriptionContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },

  spaceDescription: {
    fontSize: typography.size.md,
    lineHeight: typography.size.md * 1.4,
    marginBottom: spacing.sm,
  },
});
