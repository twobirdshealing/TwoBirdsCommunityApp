// =============================================================================
// USE SPACE ACTIVITIES — fetches /activities once per space, shared by sheets
// =============================================================================
// Both SpaceFeaturedSheet and SpaceActivitySheet read from the SAME endpoint
// (with_pins=1 returns both pinned posts and activity events in one call).
// Using useAppQuery with a stable key means TanStack Query dedups the network
// request — opening Featured then Activity costs one round-trip, not two.
// =============================================================================

import { useAppQuery, WIDGET_STALE_TIME } from '@/hooks/useAppQuery';
import { activitiesApi } from '@/services/api/activities';
import { CACHE_EVENTS } from '@/utils/cacheEvents';
import type { PinnedPost, SpaceActivity } from '@/types/activity';

interface UseSpaceActivitiesResult {
  pinnedPosts: PinnedPost[];
  activities: SpaceActivity[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useSpaceActivities(
  spaceId: number | null | undefined,
  enabled: boolean = true,
): UseSpaceActivitiesResult {
  const { data, isLoading, isRefreshing, error, refresh } = useAppQuery({
    cacheKey: `tbc_space_activities_${spaceId ?? 0}`,
    enabled: enabled && !!spaceId,
    invalidateOn: CACHE_EVENTS.FEEDS,  // pin changes / new posts invalidate this
    staleTime: WIDGET_STALE_TIME,       // 2 min — activities don't need to be live
    fetcher: async () => {
      if (!spaceId) return { pinned_posts: [], activities: { data: [] } };
      const response = await activitiesApi.getSpaceActivities(spaceId);
      if (!response.success) throw new Error(response.error.message || 'Failed to load activities');
      return response.data;
    },
  });

  return {
    pinnedPosts: data?.pinned_posts ?? [],
    activities: data?.activities?.data ?? [],
    isLoading,
    isRefreshing,
    error,
    refresh,
  };
}
