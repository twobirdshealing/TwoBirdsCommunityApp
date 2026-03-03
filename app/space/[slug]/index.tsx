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
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { Feed } from '@/types/feed';
import { Space } from '@/types/space';
import { feedsApi } from '@/services/api/feeds';
import { spacesApi } from '@/services/api/spaces';
import { FeedList } from '@/components/feed/FeedList';
import { SpaceMenu } from '@/components/space/SpaceMenu';
import { SpaceInfoHeader } from '@/components/space/SpaceInfoHeader';
import { PageHeader } from '@/components/navigation/PageHeader';
import { useFeedReactions } from '@/hooks/useFeedReactions';
import { useFeedActions } from '@/hooks/useFeedActions';

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

      if (response.success) {
        const spaceData = response.data.space;
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
        if (membersResponse.success) {
          const total = membersResponse.data?.members?.total
            || membersResponse.data?.meta?.total;
          if (total) {
            setMembersCount(total);
          }
        }
      } catch (err) {
        // Members count fetch failed silently
      }
      
    } catch (err) {
      if (__DEV__) console.error('Failed to load space:', err);
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
      if (__DEV__) console.error('Fetch feeds error:', err);
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
  // Shared Feed Actions
  // ---------------------------------------------------------------------------

  const {
    handleCommentPress, openComposer, handleEdit,
    handleBookmarkToggle, handleDelete,
    handleAuthorPress,
  } = useFeedActions({ setFeeds, refresh: () => fetchFeeds(true), defaultSpace: slug, defaultSpaceName: space?.title });

  const handleReact = useFeedReactions(feeds, setFeeds);

  const handleRefresh = () => {
    fetchSpace();
    fetchFeeds(true);
  };

  // ---------------------------------------------------------------------------
  // Pin Handler (space-specific: checks admin/moderator permissions)
  // ---------------------------------------------------------------------------

  const handlePin = async (feed: Feed) => {
    const newStickyState = !feed.is_sticky;
    
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
      if (__DEV__) console.error('Pin toggle error:', err);
      Alert.alert('Error', 'Failed to pin post');
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
    if (!space) return false;

    // API returns role in membership.pivot.role
    // AND permissions object with community_admin, community_moderator, edit_any_feed
    const membershipRole = space.membership?.pivot?.role;
    const permissions = space.permissions;

    // Check if user has admin/mod role OR has edit_any_feed permission
    const hasRole = membershipRole === 'admin' || membershipRole === 'moderator';
    const hasPermission = permissions?.community_admin ||
                          permissions?.community_moderator ||
                          permissions?.edit_any_feed;

    return hasRole || hasPermission;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const canPinResult = canPin();
  
  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
      {/* Header - Using PageHeader with SpaceMenu */}
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
        ListHeaderComponent={
          space ? (
            <SpaceInfoHeader
              space={space}
              membersCount={membersCount}
              postsCount={postsCount}
              onPostPress={openComposer}
            />
          ) : undefined
        }
        emptyMessage="No posts in this space yet"
        emptyIcon="document-text-outline"
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
});
