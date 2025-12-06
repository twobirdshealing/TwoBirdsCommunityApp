// =============================================================================
// FEED TYPES - TypeScript definitions for feed/post data
// =============================================================================
// Based on Fluent Community Feeds API documentation
// =============================================================================

import { XProfile } from './user';

// -----------------------------------------------------------------------------
// Feed - A post in the community
// -----------------------------------------------------------------------------

export interface Feed {
  id: number;
  user_id: string | number;
  parent_id: number | null;
  title: string | null;
  slug: string;
  message: string;
  message_rendered: string;
  type: FeedType;
  content_type: ContentType;
  space_id: string | number;
  privacy: 'public' | 'private';
  status: FeedStatus;
  featured_image: string | null;
  meta: Record<string, any>;
  is_sticky: number;  // 0 or 1
  comments_count: number | string;
  reactions_count: number | string;
  priority: number;
  expired_at: string | null;
  scheduled_at: string | null;
  created_at: string;
  updated_at?: string;
  permalink: string;
  
  // Related data (included in response)
  xprofile?: XProfile;
  space?: FeedSpace;
  comments?: any[];  // Will define Comment type separately
  reactions?: Reaction[];
  terms?: any[];
}

// -----------------------------------------------------------------------------
// Feed Type - What kind of post is this?
// -----------------------------------------------------------------------------

export type FeedType = 
  | 'feed'          // Standard post (default)
  | 'text'          // Text post
  | 'announcement'  // Important announcement
  | 'course_lesson' // Course lesson content
  | 'question';     // Q&A post

// -----------------------------------------------------------------------------
// Content Type - How is the content formatted?
// -----------------------------------------------------------------------------

export type ContentType =
  | 'text'      // Plain text
  | 'markdown'  // Markdown formatted
  | 'html'      // HTML formatted
  | 'document'  // Document library
  | 'survey'    // Poll/survey
  | 'video'     // Video content
  | 'audio';    // Audio content

// -----------------------------------------------------------------------------
// Feed Status
// -----------------------------------------------------------------------------

export type FeedStatus =
  | 'published'  // Live and visible
  | 'draft'      // Not yet published
  | 'scheduled'  // Scheduled for future
  | 'pending'    // Awaiting moderation
  | 'spam';      // Marked as spam

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
export interface ReactResponse {
  message: string;
  data: {
    reaction: Reaction;
    action: 'added' | 'removed';
  };
}
