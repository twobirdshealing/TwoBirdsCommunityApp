// =============================================================================
// SPACE PAGE - Individual space feed view with post creation
// =============================================================================
// Route: /space/[slug]
// UPDATED: Added QuickPostBox + CreatePostModal with space pre-selected
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { Space, Feed } from '@/types';
import { spacesApi, feedsApi } from '@/services/api';
import { FeedList } from '@/components/feed';
import { CommentSheet } from '@/components/feed/CommentSheet';
import { SpaceHeader, SpaceMenu } from '@/components/space';
import { LoadingSpinner, ErrorMessage } from '@/components/common';
import { QuickPostBox, CreatePostModal, ComposerSubmitData } from '@/components/composer';

export default function SpacePage() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();

  // State
  const [space, setSpace] = useState<Space | null>(null);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showComposer, setShowComposer] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch Space Details
  // ---------------------------------------------------------------------------

  const fetchSpaceDetails = useCallback(async () => {
    if (!slug) return;

    try {
      const response = await spacesApi.getSpaceBySlug(slug);

      if (response.success) {
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

  // ---------------------------------------------------------------------------
  // Initial Load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await fetchSpaceDetails();
      await fetchSpaceFeeds();
    };
    loadAll();
  }, [fetchSpaceDetails, fetchSpaceFeeds]);

  // ---------------------------------------------------------------------------
  // Create Post (to this space)
  // ---------------------------------------------------------------------------

  const handleCreatePost = async (data: ComposerSubmitData) => {
    if (!space) return;

    try {
      const response = await feedsApi.createFeed({
        message: data.message,
        title: data.title,
        content_type: data.content_type,
        space_id: space.id, // Always post to this space
        meta: data.meta,
      });

      if (response.success) {
        fetchSpaceFeeds(true);
        Alert.alert('Success', 'Your post has been published!');
      } else {
        throw new Error(response.error?.message || 'Failed to create post');
      }
    } catch (err) {
      console.error('Create post error:', err);
      throw err;
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    fetchSpaceFeeds(true);
  };

  const handleFeedPress = (feed: Feed) => {
    router.push({
      pathname: '/feed/[id]',
      params: { id: feed.id.toString(), space: slug, context: 'space' },
    });
  };

  // Open comment sheet
  const handleCommentPress = (feed: Feed) => {
    setSelectedFeedId(feed.id);
    setShowComments(true);
  };

  const handleCloseComments = () => {
    setShowComments(false);
    setSelectedFeedId(null);
  };

  const handleCommentAdded = () => {
    fetchSpaceFeeds(true);
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

  // Callback when user leaves the space
  const handleLeaveSuccess = () => {
    // Space has been left, the SpaceMenu already navigates back
  };

  // ---------------------------------------------------------------------------
  // Render States
  // ---------------------------------------------------------------------------

  if (loading && !space) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{ 
            headerShown: true,
            title: 'Loading...' 
          }} 
        />
        <LoadingSpinner message="Loading space..." />
      </View>
    );
  }

  if (error && !space) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{ 
            headerShown: true,
            title: 'Error' 
          }} 
        />
        <ErrorMessage message={error} onRetry={fetchSpaceDetails} />
      </View>
    );
  }

  if (!space) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{ 
            headerShown: true,
            title: 'Not Found' 
          }} 
        />
        <ErrorMessage message="Space not found" />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // List Header - SpaceHeader + QuickPostBox
  // ---------------------------------------------------------------------------

  const ListHeader = (
    <>
      <SpaceHeader space={space} />
      {/* Quick Post Box - only show if user is a member */}
      {space.is_joined && (
        <QuickPostBox
          placeholder={`Post to ${space.title}...`}
          onPress={() => setShowComposer(true)}
        />
      )}
    </>
  );

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Top nav with back button and menu */}
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: space.title,
          headerBackTitle: 'Back',
          headerRight: () => (
            <SpaceMenu
              slug={slug}
              role={space.role}
              onLeaveSuccess={handleLeaveSuccess}
            />
          ),
        }} 
      />

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
        emptyMessage="No posts in this space yet"
        emptyIcon="📭"
        ListHeaderComponent={ListHeader}
      />

      {/* Create Post Modal - space pre-selected */}
      <CreatePostModal
        visible={showComposer}
        onClose={() => setShowComposer(false)}
        onSubmit={handleCreatePost}
        spaceId={space.id}
        spaceName={space.title}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
