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
import { useAppQuery, useArrayMutate } from '@/hooks/useAppQuery';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
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
  // Space metadata (manual state — has redirects, lock screen, permission side effects)
  const [space, setSpace] = useState<Space | null>(null);
  const [lockscreenConfig, setLockscreenConfig] = useState<LockScreenConfig | null>(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch Space Data (manual — side effects don't fit useAppQuery)
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
  // Fetch Feeds (useCachedData — consistent with all other feed screens)
  // ---------------------------------------------------------------------------

  const {
    data: feedsData,
    isLoading: loading,
    isRefreshing: refreshing,
    error: fetchError,
    refresh: refreshFeeds,
    mutate,
  } = useAppQuery<Feed[]>({
    cacheKey: `tbc_space_feeds_${slug}`,
    invalidateOn: CACHE_EVENTS.FEEDS,
    fetcher: async () => {
      const response = await feedsApi.getFeeds({ space: slug, per_page: 20 });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load feeds');
      }

      // Handle the response structure
      let rawFeeds: Feed[] = [];
      if (response.data.feeds?.data) {
        rawFeeds = response.data.feeds.data;
      } else if (Array.isArray(response.data.feeds)) {
        rawFeeds = response.data.feeds;
      } else if (Array.isArray(response.data)) {
        rawFeeds = response.data;
      }

      // FC 2.3.0 returns sticky as a separate top-level object (not in feeds.data)
      let stickyPosts: Feed[] = [];
      const rawSticky = response.data.sticky;
      if (rawSticky) {
        if (Array.isArray(rawSticky)) {
          stickyPosts = rawSticky;
        } else if (typeof rawSticky === 'object' && (rawSticky as any).id) {
          stickyPosts = [rawSticky as Feed];
        }
      }

      // Merge sticky at top, remove duplicates, sort rest by date
      const stickyIds = new Set(stickyPosts.map(f => f.id));
      const filteredRegular = rawFeeds.filter(f => !stickyIds.has(f.id));
      const markedSticky = stickyPosts.map(f => ({ ...f, is_sticky: true as const }));

      return [...markedSticky, ...filteredRegular.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )];
    },
    enabled: !!slug,
  });

  const feeds = feedsData || [];
  const error = fetchError?.message || null;
  const setFeeds = useArrayMutate(mutate);

  // Initial space load
  useEffect(() => { fetchSpace(); }, [fetchSpace]);
  
  // ---------------------------------------------------------------------------
  // Shared Feed Actions
  // ---------------------------------------------------------------------------

  const {
    handleCommentPress, openComposer, handleEdit,
    handleBookmarkToggle, handleDelete,
    handleAuthorPress,
  } = useFeedActions({ setFeeds, refresh: refreshFeeds, defaultSpace: slug, defaultSpaceName: space?.title });

  const handleReact = useFeedReactions(feeds, setFeeds);

  const handleRefresh = () => {
    fetchSpace();
    refreshFeeds();
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
          refreshFeeds();
        }
        cacheEvents.emit(CACHE_EVENTS.SPACES);
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
              role={space?.membership?.pivot?.role || space?.role}
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
