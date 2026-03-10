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
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { Feed } from '@/types/feed';
import { Space, LockScreenConfig } from '@/types/space';
import { feedsApi } from '@/services/api/feeds';
import { spacesApi } from '@/services/api/spaces';
import { FeedList } from '@/components/feed/FeedList';
import { SpaceMenu } from '@/components/space/SpaceMenu';
import { SpaceInfoHeader } from '@/components/space/SpaceInfoHeader';
import { SpaceLockScreen } from '@/components/space/SpaceLockScreen';
import { PageHeader } from '@/components/navigation/PageHeader';
import { useFeedReactions } from '@/hooks/useFeedReactions';
import { useFeedActions } from '@/hooks/useFeedActions';
import { cacheEvents } from '@/utils/cacheEvents';
import { optimisticUpdate } from '@/utils/optimisticUpdate';
import { createLogger } from '@/utils/logger';

const log = createLogger('SpacePage');

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
  const [lockscreenConfig, setLockscreenConfig] = useState<LockScreenConfig | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isPending, setIsPending] = useState(false);
  
  // ---------------------------------------------------------------------------
  // Fetch Space Data
  // ---------------------------------------------------------------------------
  
  const fetchSpace = useCallback(async () => {
    if (!slug) return;
    
    try {
      const response = await spacesApi.getSpaceBySlug(slug);

      if (!response.success) return;

      const spaceData = response.data.space;
      setSpace(spaceData);

      // Handle lock screen for non-members of private spaces
      const lsConfig = spaceData.lockscreen_config;
      if (spaceData.permissions?.is_non_member && lsConfig) {
        // Redirect mode — open URL in webview and go back
        if (lsConfig.redirect_url) {
          router.replace(`/webview?url=${encodeURIComponent(lsConfig.redirect_url)}&title=${encodeURIComponent(spaceData.title)}`);
          return;
        }
        setLockscreenConfig(lsConfig);
        if (lsConfig.is_pending) setIsPending(true);
        setLoading(false);
        return;
      }

      // Clear lock screen if user is now a member (e.g. after approval)
      setLockscreenConfig(null);
      setIsPending(false);
      
    } catch (err) {
      log.error('Failed to load space:', err);
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
      }
    } catch (err) {
      log.error('Fetch feeds error:', err);
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

  // Cross-screen cache invalidation (e.g. post created from composer)
  useEffect(() => cacheEvents.subscribe('feeds', () => fetchFeeds(true)), [fetchFeeds]);
  
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
    try {
      const response = await optimisticUpdate(
        setFeeds,
        prev => {
          const updated = prev.map(f =>
            f.id === feed.id ? { ...f, is_sticky: newStickyState } : f
          );
          return updated.sort((a, b) => {
            if (a.is_sticky && !b.is_sticky) return -1;
            if (!a.is_sticky && b.is_sticky) return 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        },
        () => feedsApi.toggleSticky(feed.id, newStickyState),
      );
      if (!response.success) {
        Alert.alert('Error', response.error?.message || 'Failed to update pin');
      }
    } catch (err) {
      log.error('Pin toggle error:', err);
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
  // Non-member state (for public spaces with no lock screen)
  // ---------------------------------------------------------------------------

  const isNonMember = !!(space?.permissions?.is_non_member && !lockscreenConfig);

  // ---------------------------------------------------------------------------
  // Join / Request Access Handler
  // ---------------------------------------------------------------------------

  const handleJoinSpace = async () => {
    if (!slug) return;
    setIsRequesting(true);

    // Optimistic: for public spaces, immediately show the post box
    const isPublic = space?.privacy === 'public';
    if (isPublic && space) {
      setSpace(prev => prev ? {
        ...prev,
        permissions: { ...prev.permissions, is_non_member: false },
      } : prev);
    }

    try {
      const response = await spacesApi.joinSpace(slug);
      if (response.success) {
        if (response.data?.data?.status === 'pending') {
          setIsPending(true);
          // Revert optimistic update — not auto-approved
          if (isPublic) fetchSpace();
        } else {
          // Auto-approved — refresh to get full member data
          fetchSpace();
          fetchFeeds();
        }
        cacheEvents.emit('spaces');
      } else {
        // Revert optimistic update on error
        if (isPublic) fetchSpace();
        Alert.alert('Error', response.error?.message || 'Failed to join space');
      }
    } catch (err) {
      if (isPublic) fetchSpace();
      log.error('Join space error:', err);
      Alert.alert('Error', 'Failed to join space');
    } finally {
      setIsRequesting(false);
    }
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
      
      {/* Lock Screen for non-members of private spaces */}
      {lockscreenConfig && space ? (
        <ScrollView style={{ flex: 1 }}>
          <SpaceInfoHeader
            space={space}
            onPostPress={() => {}}
            hidePostBox
          />
          <SpaceLockScreen
            config={lockscreenConfig}
            onRequestAccess={handleJoinSpace}
            isPending={isPending}
            isRequesting={isRequesting}
          />
        </ScrollView>
      ) : (
        /* Feed List for members */
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
                onPostPress={openComposer}
                isNonMember={isNonMember}
                onJoinPress={handleJoinSpace}
                isJoining={isRequesting}
              />
            ) : undefined
          }
          emptyMessage="No posts in this space yet"
          emptyIcon="document-text-outline"
        />
      )}
      
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
