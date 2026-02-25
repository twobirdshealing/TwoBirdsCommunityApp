// =============================================================================
// SINGLE POST VIEW - View a single post with full content
// =============================================================================
// Route: /feed/{id}
// Used for: notifications, deep links, push notifications
// Reuses FeedCard with variant="full" for consistent rendering
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { FeedCard } from '@/components/feed/FeedCard';
import { LoadingSpinner, ErrorMessage } from '@/components/common';
import { CommentSheet } from '@/components/feed/CommentSheet';
import { CreatePostModal, ComposerSubmitData } from '@/components/composer';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/constants/layout';
import { Feed } from '@/types';
import { feedsApi } from '@/services/api';
import { useFeedReactions } from '@/hooks';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SinglePostScreen() {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  // State
  const [feed, setFeed] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const [showComposer, setShowComposer] = useState(false);

  // Adapt single-feed state for the shared reaction hook
  const feedsArray = useMemo(() => feed ? [feed] : [], [feed]);
  const setFeedsArray = useCallback<React.Dispatch<React.SetStateAction<Feed[]>>>((updater) => {
    setFeed(prev => {
      const arr = prev ? [prev] : [];
      const result = typeof updater === 'function' ? updater(arr) : updater;
      return result[0] ?? prev;
    });
  }, []);
  const handleReact = useFeedReactions(feedsArray, setFeedsArray);

  // ---------------------------------------------------------------------------
  // Fetch single feed
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (id) fetchFeed();
  }, [id]);

  const fetchFeed = async () => {
    try {
      setLoading(true);
      setError(null);

      const numericId = Number(id);
      const response = isNaN(numericId)
        ? await feedsApi.getFeedBySlug(id!)
        : await feedsApi.getFeedById(numericId);

      if (response.success && response.data?.feed) {
        setFeed(response.data.feed);
      } else {
        setError('Post not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleBookmarkToggle = async (isBookmarked: boolean) => {
    if (!feed) return;
    try {
      await feedsApi.toggleBookmark(feed.id, !isBookmarked);
      setFeed({ ...feed, bookmarked: isBookmarked });
    } catch (err) {
      if (__DEV__) console.error('Failed to bookmark:', err);
    }
  };

  const handleDelete = () => {
    if (!feed) return;
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await feedsApi.deleteFeed(feed.id);
              router.back();
            } catch (err) {
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    setShowComposer(true);
  };

  const handleEditPost = async (data: ComposerSubmitData) => {
    if (!feed) return;
    try {
      const response = await feedsApi.updateFeed(feed.id, {
        message: data.message,
        title: data.title,
        content_type: data.content_type,
        media_images: data.media_images,
      });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to update post');
      }
      if (response.data?.feed) {
        setFeed(response.data.feed);
      }
    } catch (err) {
      if (__DEV__) console.error('Edit post error:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to update post');
    }
  };

  const handleCommentAdded = () => {
    fetchFeed(); // Refresh to update comment count
  };

  // ---------------------------------------------------------------------------
  // Loading & Error states
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ title: 'Post', headerStyle: { backgroundColor: themeColors.surface }, headerTintColor: themeColors.text }} />
        <LoadingSpinner />
      </View>
    );
  }

  if (error || !feed) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Stack.Screen options={{ title: 'Post', headerStyle: { backgroundColor: themeColors.surface }, headerTintColor: themeColors.text }} />
        <ErrorMessage message={error || 'Post not found'} onRetry={fetchFeed} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render - uses FeedCard with variant="full"
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen
        options={{
          title: 'Post',
          headerStyle: { backgroundColor: themeColors.surface },
          headerTintColor: themeColors.text,
          headerBackTitle: 'Back',
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <FeedCard
          feed={feed}
          variant="full"
          onReact={(type) => handleReact(feed.id, type)}
          onAuthorPress={() => {
            if (feed.xprofile?.username) {
              router.push(`/profile/${feed.xprofile.username}`);
            }
          }}
          onSpacePress={() => {
            if (feed.space?.slug) {
              router.push(`/space/${feed.space.slug}`);
            }
          }}
          onCommentPress={() => setShowComments(true)}
          onBookmarkToggle={handleBookmarkToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </ScrollView>

      {/* ===== Edit Post Modal ===== */}
      <CreatePostModal
        visible={showComposer}
        onClose={() => setShowComposer(false)}
        onSubmit={handleEditPost}
        editFeed={feed}
      />

      {/* ===== Comment Sheet ===== */}
      <CommentSheet
        visible={showComments}
        postId={feed.id}
        onClose={() => setShowComments(false)}
        onCommentAdded={handleCommentAdded}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles (only screen-level styles, FeedCard handles its own)
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingVertical: spacing.md,
  },
});
