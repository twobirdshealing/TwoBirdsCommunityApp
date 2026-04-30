// =============================================================================
// SPACE ACTIVITY TYPES — feed_published / comment_added events + pinned posts
// =============================================================================
// Powered by GET /activities?context[space_id]={id}&with_pins=1.
// One round-trip yields BOTH the "Recent Space Activities" list and the
// "Featured Posts" list (returned in `pinned_posts`).
// =============================================================================

// -----------------------------------------------------------------------------
// Activity actor — minimal xprofile fields the activity endpoint includes
// -----------------------------------------------------------------------------

export interface ActivityXProfile {
  user_id: number;
  display_name: string;
  avatar?: string | null;
  permalink?: string;
}

// -----------------------------------------------------------------------------
// Activity route — server-formatted deep-link target for tap navigation
// -----------------------------------------------------------------------------
// Server emits e.g. { name: 'feed_detail', params: { slug, spaceSlug }, query: { comment_id? } }.
// We use `params.slug` to navigate to /feed/{slug}; `query.comment_id` if present
// signals the post detail to scroll to that comment.

export interface ActivityRoute {
  name: string;
  params: {
    slug: string;
    spaceSlug?: string;
  };
  query?: {
    comment_id?: number;
  };
}

// -----------------------------------------------------------------------------
// SpaceActivity — one row in the "Recent Activity" sheet
// -----------------------------------------------------------------------------
// Action types observed: 'feed_published', 'comment_added'.
// `message` is server-formatted ("Sam England added a comment on…") — render as-is.

export interface SpaceActivity {
  id: number;
  message: string;
  xprofile: ActivityXProfile;
  updated_at: string;
  route?: ActivityRoute;
}

// -----------------------------------------------------------------------------
// PinnedPost — one row in the "Featured Posts" sheet
// -----------------------------------------------------------------------------
// Returned in the same /activities response under `pinned_posts` when
// `with_pins=1` is passed. Server caps this list at 5.

export interface PinnedPost {
  id: number;
  message: string;
  permalink: string;
  xprofile: ActivityXProfile;
  created_at: string;
}

// -----------------------------------------------------------------------------
// API response shape
// -----------------------------------------------------------------------------

export interface SpaceActivitiesResponse {
  activities: {
    data: SpaceActivity[];
    has_more?: boolean;
    per_page?: number;
    current_page?: number;
  };
  pinned_posts?: PinnedPost[];
  before_contents?: string;
  after_contents?: string;
}
