// =============================================================================
// MULTI-REACTIONS API - Module-owned API functions
// =============================================================================
// All API calls to the tbc-multi-reactions plugin live here, not in core.
// Core services/api/ has no knowledge of multi-reactions.
// =============================================================================

import { ENDPOINTS, SITE_URL } from '@/constants/config';
import { post, request } from '@/services/api/client';
import { ReactResponse, ReactionBreakdown, ReactionType } from '@/types/feed';

const TBC_MR_URL = `${SITE_URL}/wp-json/tbc-multi-reactions/v1`;

// -----------------------------------------------------------------------------
// React to Feed (with reaction type header)
// -----------------------------------------------------------------------------

export async function reactToFeedWithType(
  feedId: number,
  type: ReactionType,
  hasUserReact: boolean = false
) {
  // Always send 'like' to FC — FC only understands 'like' as a reaction type.
  // The actual multi-reaction type is sent via X-TBC-Reaction-Type header,
  // which the tbc-multi-reactions plugin intercepts and stores.
  const payload: { react_type: string; remove?: boolean } = {
    react_type: 'like',
  };

  if (hasUserReact) {
    payload.remove = true;
  }

  const headers: Record<string, string> = {
    'X-TBC-Reaction-Type': type,
  };

  return post<ReactResponse>(ENDPOINTS.FEED_REACT(feedId), payload, undefined, headers);
}

// -----------------------------------------------------------------------------
// React to Comment (with reaction type header)
// -----------------------------------------------------------------------------

export async function reactToCommentWithType(
  postId: number,
  commentId: number,
  hasReacted: boolean = false,
  reactionType: ReactionType = 'like'
) {
  const payload = {
    state: hasReacted ? 0 : 1,
  };

  const headers: Record<string, string> = {
    'X-TBC-Reaction-Type': reactionType,
  };

  return post<ReactResponse>(`${ENDPOINTS.POST_COMMENTS(postId)}/${commentId}/reactions`, payload, undefined, headers);
}

// -----------------------------------------------------------------------------
// Swap Reaction Type (change existing reaction to different type)
// -----------------------------------------------------------------------------

export async function swapReactionType(
  objectId: number,
  objectType: 'feed' | 'comment',
  reactionType: ReactionType
) {
  return request('/swap', {
    method: 'POST',
    body: { object_id: objectId, object_type: objectType, reaction_type: reactionType },
    baseUrl: TBC_MR_URL,
  });
}

// -----------------------------------------------------------------------------
// Get Reaction Breakdown (server-accurate counts after mutation)
// -----------------------------------------------------------------------------

export interface ReactionBreakdownResponse {
  breakdown: ReactionBreakdown[];
  total: number;
  user_reaction_type?: string | null;
}

export async function getReactionBreakdown(
  objectType: 'feed' | 'comment',
  objectId: number
) {
  return request<ReactionBreakdownResponse>(`/breakdown/${objectType}/${objectId}`, {
    baseUrl: TBC_MR_URL,
  });
}

// -----------------------------------------------------------------------------
// Get Reaction Breakdown with Users
// -----------------------------------------------------------------------------

export interface BreakdownUser {
  user_id: number;
  display_name: string;
  avatar: string;
  user_url?: string;
  is_verified?: number;
  badge_slugs?: string[];
}

export interface BreakdownItem {
  type: ReactionType;
  emoji: string;
  icon_url?: string | null;
  name: string;
  count: number;
  color: string;
  users: BreakdownUser[];
  has_more?: boolean;
}

export interface BreakdownResponse {
  breakdown: BreakdownItem[];
  total: number;
}

export async function getReactionBreakdownUsers(
  objectType: 'feed' | 'comment',
  objectId: number
) {
  return request<BreakdownResponse>(`/breakdown/${objectType}/${objectId}/users`, {
    baseUrl: TBC_MR_URL,
  });
}

// -----------------------------------------------------------------------------
// Reconcile Reaction Breakdown (non-blocking server sync after mutation)
// -----------------------------------------------------------------------------

/** Reconcile via per-item updater (used by slot components with onFeedUpdate) */
export function reconcileViaItemUpdate(
  objectType: 'feed' | 'comment',
  objectId: number,
  onFeedUpdate: (updater: (feed: any) => any) => void,
) {
  getReactionBreakdown(objectType, objectId).then(res => {
    if (!res.success) return;
    onFeedUpdate(feed => ({
      ...feed,
      reaction_breakdown: res.data.breakdown,
      reaction_total: res.data.total,
      reactions_count: res.data.total,
      user_reaction_type: res.data.user_reaction_type ?? feed.user_reaction_type,
    }));
  }).catch(() => {
    // Best-effort — optimistic UI is already close enough
  });
}
