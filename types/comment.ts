// =============================================================================
// COMMENT TYPES - TypeScript definitions for comment data
// =============================================================================
// Updated with ProfileComment type for user timeline
// =============================================================================

import { XProfile } from './user';
import { Reaction } from './feed';

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
  };
  [key: string]: any;
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
