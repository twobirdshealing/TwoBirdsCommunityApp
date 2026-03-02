// =============================================================================
// USE FEED ACTIONS - Shared feed action state & handlers
// =============================================================================
// Extracts the duplicated comment sheet, composer modal, bookmark, delete,
// create/edit post, and navigation handlers used across feed-list screens.
//
// Used by: activity.tsx, bookmarks.tsx, space/[slug]/index.tsx
// NOT used by: feed/[id].tsx (single-feed view, different patterns)
// =============================================================================

import { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feed } from '@/types/feed';
import { ComposerSubmitData } from '@/components/composer/CreatePostModal';
import { feedsApi } from '@/services/api/feeds';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseFeedActionsOptions {
  /** SetState-compatible updater for optimistic updates */
  setFeeds: React.Dispatch<React.SetStateAction<Feed[]>>;
  /** Refresh feeds from server (after comment added, etc.) */
  refresh: () => void;
  /** Default space slug for new post creation (space page only) */
  defaultSpace?: string;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useFeedActions({
  setFeeds,
  refresh,
  defaultSpace,
}: UseFeedActionsOptions) {
  const router = useRouter();

  // -- Comment Sheet State --
  const [showComments, setShowComments] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedFeedSlug, setSelectedFeedSlug] = useState<string | undefined>(undefined);

  // -- Composer Modal State --
  const [showComposer, setShowComposer] = useState(false);
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);

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
    refresh();
  };

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const handleAuthorPress = (username: string) => {
    router.push({
      pathname: '/profile/[username]',
      params: { username },
    });
  };

  const handleSpacePress = (spaceSlug: string) => {
    router.push({
      pathname: '/space/[slug]',
      params: { slug: spaceSlug },
    });
  };

  // ---------------------------------------------------------------------------
  // Composer (Create + Edit)
  // ---------------------------------------------------------------------------

  const openComposer = () => setShowComposer(true);

  const handleEdit = (feed: Feed) => {
    setEditingFeed(feed);
    setShowComposer(true);
  };

  const closeComposer = () => {
    setShowComposer(false);
    setEditingFeed(null);
  };

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

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to update post');
        }
        if (response.data?.feed) {
          setFeeds(prev =>
            prev.map(f => f.id === editingFeed.id ? response.data!.feed : f)
          );
        }
      } else {
        // CREATE MODE
        const response = await feedsApi.createFeed({
          message: data.message,
          title: data.title,
          space: data.space || defaultSpace,
          content_type: data.content_type,
          media_images: data.media_images,
        });

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to create post');
        }
        if (response.data?.feed) {
          setFeeds(prev => [response.data!.feed, ...prev]);
        }
      }
    } catch (err) {
      if (__DEV__) console.error(`${editingFeed ? 'Edit' : 'Create'} post error:`, err);
      throw new Error(
        err instanceof Error ? err.message : `Failed to ${editingFeed ? 'update' : 'create'} post`
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Bookmark Toggle
  // ---------------------------------------------------------------------------

  const handleBookmarkToggle = async (feed: Feed, isBookmarked: boolean) => {
    try {
      await feedsApi.toggleBookmark(feed.id, !isBookmarked);
      setFeeds(prev =>
        prev.map(f =>
          f.id === feed.id ? { ...f, bookmarked: isBookmarked } : f
        )
      );
    } catch (err) {
      if (__DEV__) console.error('Bookmark error:', err);
      Alert.alert('Error', 'Failed to update bookmark');
    }
  };

  // ---------------------------------------------------------------------------
  // Delete (with confirmation dialog)
  // ---------------------------------------------------------------------------

  const handleDelete = (feed: Feed) => {
    Alert.alert(
      'Delete Post',
      'Are you sure you want to delete this post? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await feedsApi.deleteFeed(feed.id);
              if (response.success) {
                setFeeds(prev => prev.filter(f => f.id !== feed.id));
                Alert.alert('Deleted', 'Post deleted successfully');
              } else {
                Alert.alert('Error', response.error?.message || 'Failed to delete post');
              }
            } catch (err) {
              if (__DEV__) console.error('Delete error:', err);
              Alert.alert('Error', 'Failed to delete post');
            }
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Return
  // ---------------------------------------------------------------------------

  return {
    // Comment sheet
    showComments,
    selectedFeedId,
    selectedFeedSlug,
    handleCommentPress,
    handleCloseComments,
    handleCommentAdded,

    // Composer
    showComposer,
    editingFeed,
    openComposer,
    handleEdit,
    closeComposer,
    handleCreateOrEditPost,

    // Actions
    handleBookmarkToggle,
    handleDelete,

    // Navigation
    handleAuthorPress,
    handleSpacePress,
  };
}
