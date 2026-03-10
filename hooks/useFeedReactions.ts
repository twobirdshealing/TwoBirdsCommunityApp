// =============================================================================
// USE FEED REACTIONS - Shared hook for feed reaction handling
// =============================================================================
// Provides optimistic reaction updates with API sync and error reversion.
// Works with any screen that manages Feed[] state.
// =============================================================================

import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { Feed, ReactionType } from '@/types/feed';
import { useReactionConfig } from '@/hooks/useReactionConfig';
import { updateBreakdownOptimistically, reconcileReactionBreakdown } from '@/utils/reactionHelpers';
import { feedsApi } from '@/services/api/feeds';
import { optimisticUpdate } from '@/utils/optimisticUpdate';

export function useFeedReactions(
  feeds: Feed[],
  setFeeds: React.Dispatch<React.SetStateAction<Feed[]>>
) {
  const { getReaction } = useReactionConfig();
  const feedsRef = useRef(feeds);
  feedsRef.current = feeds;

  const handleReact = useCallback(async (feedId: number, type: ReactionType) => {
    const feed = feedsRef.current.find(f => f.id === feedId);
    if (!feed) return;

    const hasUserReact = feed.has_user_react || false;
    const currentType = feed.user_reaction_type || null;
    const isSameType = hasUserReact && currentType === type;
    const willRemove = isSameType;
    const willSwap = hasUserReact && !isSameType;

    try {
      const response = await optimisticUpdate(
        setFeeds,
        prev => prev.map(f => {
          if (f.id !== feedId) return f;
          const currentCount = typeof f.reactions_count === 'string'
            ? parseInt(f.reactions_count, 10)
            : f.reactions_count || 0;
          const action = willRemove ? 'remove' : willSwap ? 'swap' : 'add';
          const updatedBreakdown = updateBreakdownOptimistically(
            f.reaction_breakdown || [], type, action,
            currentType as ReactionType | null, getReaction,
          );

          if (willRemove) {
            return { ...f, has_user_react: false, user_reaction_type: null, user_reaction_icon_url: null, user_reaction_name: null, reactions_count: currentCount - 1, reaction_total: currentCount - 1, reaction_breakdown: updatedBreakdown };
          } else if (willSwap) {
            return { ...f, user_reaction_type: type, user_reaction_icon_url: null, user_reaction_name: null, reaction_breakdown: updatedBreakdown };
          } else {
            return { ...f, has_user_react: true, user_reaction_type: type, user_reaction_icon_url: null, user_reaction_name: null, reactions_count: currentCount + 1, reaction_total: currentCount + 1, reaction_breakdown: updatedBreakdown };
          }
        }),
        () => willSwap
          ? feedsApi.swapReactionType(feedId, 'feed', type)
          : feedsApi.reactToFeed(feedId, type, willRemove),
      );

      // Reconcile with server-accurate breakdown (non-blocking)
      if (response.success) {
        reconcileReactionBreakdown('feed', feedId, setFeeds);
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update reaction');
    }
  }, [setFeeds, getReaction]);

  return handleReact;
}
