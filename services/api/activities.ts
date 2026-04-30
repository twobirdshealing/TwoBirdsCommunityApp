// =============================================================================
// SPACE ACTIVITIES API — Featured Posts + Recent Activity (one round-trip)
// =============================================================================
// Endpoint: GET /wp-json/fluent-community/v2/activities
// One call powers BOTH the Featured Posts sheet (response.pinned_posts) AND
// the Recent Activity sheet (response.activities.data) when `with_pins=1`.
// =============================================================================

import { ENDPOINTS } from '@/constants/config';
import type { SpaceActivitiesResponse } from '@/types/activity';
import { get } from './client';

// -----------------------------------------------------------------------------
// Options
// -----------------------------------------------------------------------------

export interface GetSpaceActivitiesOptions {
  per_page?: number;       // default 5 (server cap is also ~5)
  page?: number;           // default 1
  with_pins?: boolean;     // default true — include pinned_posts in response
  is_trending?: boolean;   // false → newest first; true → 7-day window by reactions+comments
}

// -----------------------------------------------------------------------------
// Get activities for a single space
// -----------------------------------------------------------------------------

export async function getSpaceActivities(
  spaceId: number,
  options: GetSpaceActivitiesOptions = {}
) {
  const params: Record<string, any> = {
    'context[space_id]': spaceId,
    page: options.page ?? 1,
    per_page: options.per_page ?? 5,
    with_pins: options.with_pins === false ? 0 : 1,
  };

  if (options.is_trending) params.is_trending = 1;

  return get<SpaceActivitiesResponse>(ENDPOINTS.ACTIVITIES, params);
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const activitiesApi = {
  getSpaceActivities,
};

export default activitiesApi;
