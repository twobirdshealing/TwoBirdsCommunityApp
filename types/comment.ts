// =============================================================================
// COMMENT TYPES - TypeScript definitions for comment data
// =============================================================================
// Based on Fluent Community Comments API documentation
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
  parent_id: number | null;  // For nested replies
  message: string;
  message_rendered: string;
  type: 'comment';
  content_type: 'text' | 'markdown' | 'html';
  status: CommentStatus;
  reactions_count: number | string;
  is_sticky: number | string;  // 0 or 1
  meta: Record<string, any>;
  created_at: string;
  updated_at: string;
  
  // Author info
  xprofile?: XProfile;
  
  // Reactions on this comment
  reactions?: Reaction[];
  
  // Nested replies (if fetched)
  replies?: Comment[];
}

// -----------------------------------------------------------------------------
// Comment Status
// -----------------------------------------------------------------------------

export type CommentStatus = 
  | 'published'  // Live and visible
  | 'pending'    // Awaiting moderation
  | 'spam';      // Marked as spam

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

// Response from GET /feeds/{feed_id}/comments
export interface CommentsResponse {
  comments: Comment[];
}

// Response from POST /feeds/{feed_id}/comments
export interface CreateCommentResponse {
  message: string;
  data: Comment;
}

// Response from POST /feeds/{feed_id}/comments/{comment_id}
export interface UpdateCommentResponse {
  message: string;
  data: Comment;
}
