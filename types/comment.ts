// =============================================================================
// COMMENT TYPES - TypeScript definitions for comment data
// =============================================================================
// Updated with ProfileComment type for user timeline
// =============================================================================

import { XProfile } from './user';
import { Reaction, ReactionBreakdown, ReactionType } from './feed';

// -----------------------------------------------------------------------------
// Comment - A response to a feed or another comment
// -----------------------------------------------------------------------------

export interface Comment {
  id: number;
  user_id: string | number;
  post_id: string | number;
  parent_id: number | null;
  message: string;
  message_rendered: string;
  type: 'comment';
  content_type: 'text' | 'markdown' | 'html';
  status: CommentStatus;
  reactions_count: number | string;
  has_user_react?: boolean;
  user_reaction_type?: ReactionType | null;
  user_reaction_icon_url?: string | null;
  user_reaction_name?: string | null;
  reaction_breakdown?: ReactionBreakdown[];
  reaction_total?: number;
  is_sticky: number | string;
  meta: CommentMeta;
  created_at: string;
  updated_at: string;
  
  xprofile?: XProfile;
  reactions?: Reaction[];
  replies?: Comment[];
}

// -----------------------------------------------------------------------------
// Profile Comment - Comment shown in user profile timeline
// -----------------------------------------------------------------------------

export interface ProfileComment extends Comment {
  post: {
    id: number;
    title: string | null;
    message: string;
    message_rendered: string;
    type: string;
    permalink?: string;
    slug?: string;
  };
}

// -----------------------------------------------------------------------------
// Comment Meta
// -----------------------------------------------------------------------------

export interface CommentMeta {
  media_preview?: {
    image?: string;
    type?: 'image' | 'video' | 'link';
    provider?: 'youtube' | 'giphy' | 'external' | 'uploader';
    width?: number;
    height?: number;
  };
  [key: string]: unknown;
}

// -----------------------------------------------------------------------------
// Comment Status
// -----------------------------------------------------------------------------

export type CommentStatus = 
  | 'published'
  | 'pending'
  | 'spam';

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export interface CommentsResponse {
  comments: Comment[];
  sticky_comment?: Comment | null;
}

export interface UserCommentsResponse {
  comments: ProfileComment[];
}

export interface CreateCommentResponse {
  message: string;
  data: Comment;
}

export interface UpdateCommentResponse {
  message: string;
  data: Comment;
}
