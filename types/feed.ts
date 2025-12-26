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

  // ✅ Fluent meta payload (REAL)
  meta?: {
    bb_activity_id?: string;

    video_url?: string;

    media_preview?: {
      image?: string;
      url?: string;
      provider?: 'youtube' | 'giphy' | 'external' | 'uploader';
      type?: 'image' | 'video';
      width?: number;
      height?: number;
      title?: string;
    };

    media_items?: {
      media_id: number;
      url: string;
      type: 'image' | 'video';
      width?: number;
      height?: number;
      provider?: string;
      title?: string;
    }[];

    [key: string]: any;
  };

  // User reaction state (from API when authenticated)
  has_user_react?: boolean;
  bookmarked?: boolean;

  // Related data
  user?: XProfile;
  xprofile?: XProfile;
  space?: FeedSpace;
  comments?: any[];
  reactions?: Reaction[];
  terms?: any[];
}

// -----------------------------------------------------------------------------
// Feed Type
// -----------------------------------------------------------------------------

export type FeedType =
  | 'feed'
  | 'text'
  | 'announcement'
  | 'course_lesson'
  | 'question';

// -----------------------------------------------------------------------------
// Content Type
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
// Space info
// -----------------------------------------------------------------------------

export interface FeedSpace {
  id: number;
  title: string;
  slug: string;
  type: string;
}

// -----------------------------------------------------------------------------
// Reaction
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

export type ReactionType =
  | 'like'
  | 'love'
  | 'laugh'
  | 'wow'
  | 'sad'
  | 'angry';

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

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

export interface FeedDetailResponse {
  data: Feed;
}

export interface ReactResponse {
  message: string;
  new_count: number;
}

// -----------------------------------------------------------------------------
// Welcome Banner Types
// -----------------------------------------------------------------------------

export interface WelcomeBannerButton {
  label: string;
  link: string;
  type: 'primary' | 'secondary' | 'text' | 'link';
  newTab: 'yes' | 'no';
}

export interface WelcomeBanner {
  enabled: 'yes' | 'no';
  mediaType: 'image' | 'video';
  bannerImage?: string;
  bannerVideo?: {
    type: string;
    url?: string;
    html?: string;
  };
  title: string;
  description_rendered: string;
  ctaButtons: WelcomeBannerButton[];
  allowClose: 'yes' | 'no';
}

export interface WelcomeBannerResponse {
  welcome_banner: WelcomeBanner;
}
