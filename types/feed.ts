// =============================================================================
// FEED TYPES - TypeScript definitions for feed-related data
// =============================================================================

import { XProfile } from './profile';

// -----------------------------------------------------------------------------
// Main Feed Type
// -----------------------------------------------------------------------------

export interface Feed {
  id: number;
  user_id: number;
  space_id: number | null;
  privacy: 'public' | 'private';
  type: FeedType;
  content_type: ContentType;
  title: string | null;
  slug: string;
  message: string;
  message_rendered: string;
  is_sticky: boolean;
  featured_image: string | null;
  priority: number;
  status: FeedStatus;
  comments_count: number | string;
  reactions_count: number | string;
  created_at: string;
  updated_at: string;
  scheduled_at: string | null;
  
  // User reaction state (from API when authenticated)
  has_user_react?: boolean;    // Whether current user has reacted
  bookmarked?: boolean;        // Whether current user has bookmarked
  
  // Related data (may be included in response)
  user?: XProfile;
  xprofile?: XProfile;
  space?: FeedSpace;
  comments?: any[];
  reactions?: Reaction[];
  terms?: any[];
}

// -----------------------------------------------------------------------------
// Feed Type - What kind of post is this?
// -----------------------------------------------------------------------------

export type FeedType = 
  | 'feed'
  | 'text'
  | 'announcement'
  | 'course_lesson'
  | 'question';

// -----------------------------------------------------------------------------
// Content Type - How is the content formatted?
// -----------------------------------------------------------------------------

export type ContentType =
  | 'text'
  | 'markdown'
  | 'html'
  | 'document'
  | 'survey'
  | 'video'
  | 'audio';

// -----------------------------------------------------------------------------
// Feed Status
// -----------------------------------------------------------------------------

export type FeedStatus =
  | 'published'
  | 'draft'
  | 'scheduled'
  | 'pending'
  | 'spam';

// -----------------------------------------------------------------------------
// Space info embedded in feed
// -----------------------------------------------------------------------------

export interface FeedSpace {
  id: number;
  title: string;
  slug: string;
  type: string;
}

// -----------------------------------------------------------------------------
// Reaction on a feed
// -----------------------------------------------------------------------------

export interface Reaction {
  id: number;
  user_id: string | number;
  object_id: string | number;
  object_type: 'feed' | 'comment';
  type: ReactionType;
  created_at: string;
  xprofile?: XProfile;
}

export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry';

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

// Response from GET /feeds
export interface FeedsResponse {
  feeds: {
    data: Feed[];
    current_page: number;
    per_page: number;
    from: number;
    to: number;
    has_more: boolean;
    total: number;
  };
  sticky: Feed[] | null;
  execution_time: number;
}

// Response from GET /feeds/{id}/by-id
export interface FeedDetailResponse {
  data: Feed;
}

// Response from POST /feeds/{id}/react
// Actual API response (verified via curl)
export interface ReactResponse {
  message: string;
  new_count: number;
}
