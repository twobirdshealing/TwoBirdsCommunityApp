// =============================================================================
// SPACE PAGE - Individual space feed view
// =============================================================================
// Route: /space/[slug]
// Shows space header, menu, and feeds filtered to that space
// When user clicks a post, passes space context to full-screen viewer
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { colors } from '@/constants/colors';
import { Space, Feed } from '@/types';
import { spacesApi, feedsApi } from '@/services/api';
import { FeedList } from '@/components/feed';
import { SpaceHeader, SpaceMenu } from '@/components/space';
import { LoadingSpinner, ErrorMessage } from '@/components/common';

export default function SpacePage() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();

  // State
  const [space, setSpace] = useState<Space | null>(null);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch Space Details
  // ---------------------------------------------------------------------------

  const fetchSpaceDetails = useCallback(async () => {
    if (!slug) return;

    try {
      const response = await spacesApi.getSpaceBySlug(slug);

      if (response.success) {
        // API returns { data: { space: {...} } } not { data: {...} }
        const spaceData = (response.data as any).space || response.data.data || response.data;
        setSpace(spaceData);
      } else {
        setError(response.error?.message || 'Failed to load space');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }, [slug]);

  // ---------------------------------------------------------------------------
  // Fetch Space Feeds
  // ---------------------------------------------------------------------------

  const fetchSpaceFeeds = useCallback(async (isRefresh = false) => {
    if (!slug) return;

    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }

      // Use existing feedsApi with space filter
      const response = await feedsApi.getFeeds({ 
        space: slug,
        per_page: 20,
      });

      if (response.success) {
        setFeeds(response.data.feeds.data);
      } else {
        setError(response.error?.message || 'Failed to load posts');
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
    const loadData = async () => {
      await fetchSpaceDetails();
      await fetchSpaceFeeds();
    };
    loadData();
  }, [fetchSpaceDetails, fetchSpaceFeeds]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    fetchSpaceFeeds(true);
  };

  const handleFeedPress = (feed: Feed) => {
    // Pass space slug as context so full-screen viewer shows space feeds
    router.push(`/feed/${feed.id}?space=${slug}&context=space`);
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
            reactions_count: hasUserReact ? currentCount - 1 : currentCount + 1,
          };
        }
        return f;
      })
    );

    // API call
    try {
      await feedsApi.reactToFeed(feedId, type, hasUserReact);
    } catch (err) {
      // Revert on error
      setFeeds(prevFeeds =>
        prevFeeds.map(f => f.id === feedId ? feed : f)
      );
    }
  };

  const handleAuthorPress = (username: string) => {
    router.push(`/profile/${username}`);
  };

  // Menu handlers (Phase 2)
  const handlePostsPress = () => {
    console.log('Posts - Phase 2');
  };

  const handleMembersPress = () => {
    console.log('Members - Phase 2');
  };

  const handleDocumentsPress = () => {
    console.log('Documents - Phase 2');
  };

  const handleAboutPress = () => {
    console.log('About - Phase 2');
  };

  const handleLeavePress = () => {
    console.log('Leave Space - Phase 2');
  };

  // ---------------------------------------------------------------------------
  // Render States
  // ---------------------------------------------------------------------------

  if (loading && !space) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <LoadingSpinner message="Loading space..." />
      </View>
    );
  }

  if (error && !space) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Error' }} />
        <ErrorMessage message={error} onRetry={fetchSpaceDetails} />
      </View>
    );
  }

  if (!space) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <ErrorMessage message="Space not found" />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Set page title */}
      <Stack.Screen 
        options={{ 
          title: space.title,
          headerRight: () => (
            <SpaceMenu
              onPostsPress={handlePostsPress}
              onMembersPress={handleMembersPress}
              onDocumentsPress={handleDocumentsPress}
              onAboutPress={handleAboutPress}
              onLeavePress={handleLeavePress}
            />
          ),
        }} 
      />

      {/* Space Header + Feed List */}
      <FeedList
        feeds={feeds}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={handleRefresh}
        onFeedPress={handleFeedPress}
        onReact={handleReact}
        onAuthorPress={handleAuthorPress}
        emptyMessage="No posts in this space yet"
        emptyIcon="📭"
        ListHeaderComponent={<SpaceHeader space={space} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
