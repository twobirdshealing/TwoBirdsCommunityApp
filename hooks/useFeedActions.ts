// =============================================================================
// USE FEED ACTIONS - Shared feed action handlers for feed-list screens
// =============================================================================
// Handles navigation to composer/comments screens, bookmark, delete, and
// profile/space navigation.
//
// Used by: activity.tsx, bookmarks.tsx, space/[slug]/index.tsx
// NOT used by: feed/[id].tsx (single-feed view, different patterns)
// =============================================================================

import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feed } from '@/types/feed';
import { feedsApi } from '@/services/api/feeds';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
import { optimisticUpdate } from '@/utils/optimisticUpdate';
import { createLogger } from '@/utils/logger';

const log = createLogger('FeedActions');

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
  /** Default space name for new post creation (space page only) */
  defaultSpaceName?: string;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useFeedActions({
  setFeeds,
  refresh,
  defaultSpace,
  defaultSpaceName,
}: UseFeedActionsOptions) {
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // Comments — navigate to comments screen
  // ---------------------------------------------------------------------------

  const handleCommentPress = (feed: Feed) => {
    router.push({
      pathname: '/comments/[postId]',
      params: { postId: feed.id.toString(), feedSlug: feed.slug },
    });
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
  // Composer — navigate to create-post screen
  // ---------------------------------------------------------------------------

  const openComposer = () => {
    router.push({
      pathname: '/create-post',
      params: {
        ...(defaultSpace ? { spaceSlug: defaultSpace } : {}),
        ...(defaultSpaceName ? { spaceName: defaultSpaceName } : {}),
      },
    });
  };

  const handleEdit = (feed: Feed) => {
    router.push({
      pathname: '/create-post',
      params: {
        editId: feed.id.toString(),
      },
    });
  };

  // ---------------------------------------------------------------------------
  // Bookmark Toggle
  // ---------------------------------------------------------------------------

  const handleBookmarkToggle = async (feed: Feed, isBookmarked: boolean) => {
    try {
      const response = await optimisticUpdate(
        setFeeds,
        prev => prev.map(f => f.id === feed.id ? { ...f, bookmarked: isBookmarked } : f),
        () => feedsApi.toggleBookmark(feed.id, !isBookmarked),
      );
      if (response.success) {
        cacheEvents.emit(CACHE_EVENTS.BOOKMARKS);
      }
    } catch (err) {
      log.error('Bookmark error:', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update bookmark');
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
              log.error('Delete error:', err);
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
    // Comments
    handleCommentPress,

    // Composer
    openComposer,
    handleEdit,

    // Actions
    handleBookmarkToggle,
    handleDelete,

    // Navigation
    handleAuthorPress,
    handleSpacePress,

    // Refresh (exposed for parent focus-based refresh)
    refresh,
  };
}
