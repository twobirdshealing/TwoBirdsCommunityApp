// =============================================================================
// USE FEED REACTIONS - Basic like/unlike toggle for feed posts
// =============================================================================
// Provides optimistic like/unlike with API sync. Used by the fallback like
// button in FeedCard when no multi-reaction module slot is registered.
// =============================================================================

import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { Feed, ReactionType } from '@/types/feed';
import { feedsApi } from '@/services/api/feeds';
import { optimisticUpdate } from '@/utils/optimisticUpdate';

export function useFeedReactions(
  feeds: Feed[],
  setFeeds: React.Dispatch<React.SetStateAction<Feed[]>>
) {
  const feedsRef = useRef(feeds);
  feedsRef.current = feeds;

  const handleReact = useCallback(async (feedId: number, type: ReactionType) => {
    const feed = feedsRef.current.find(f => f.id === feedId);
    if (!feed) return;

    const hasUserReact = feed.has_user_react || false;

    try {
      await optimisticUpdate(
        setFeeds,
        prev => prev.map(f => {
          if (f.id !== feedId) return f;
          const currentCount = typeof f.reactions_count === 'string'
            ? parseInt(f.reactions_count, 10)
            : f.reactions_count || 0;

          if (hasUserReact) {
            return { ...f, has_user_react: false, user_reaction_type: null, reactions_count: currentCount - 1, reaction_total: currentCount - 1 };
          } else {
            return { ...f, has_user_react: true, user_reaction_type: 'like', reactions_count: currentCount + 1, reaction_total: currentCount + 1 };
          }
        }),
        () => feedsApi.reactToFeed(feedId, hasUserReact),
      );
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update reaction');
    }
  }, [setFeeds]);

  return handleReact;
}
