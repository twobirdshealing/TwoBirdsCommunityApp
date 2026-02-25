// =============================================================================
// COMMENTS API - All comment-related API calls
// =============================================================================
// FIXED: Use 'comment' not 'message' - matches what web app sends
// FIXED: Add media_images support for image comments
// =============================================================================

import { get, post, del, patch } from './client';
import { ENDPOINTS, DEFAULT_PER_PAGE } from '@/constants/config';
import { Comment, CommentsResponse, CreateCommentResponse, ReactResponse } from '@/types';
import { ReactionType } from '@/types/feed';

// -----------------------------------------------------------------------------
// Request Options
// -----------------------------------------------------------------------------

export interface GetCommentsOptions {
  page?: number;
  per_page?: number;
  parent_id?: number;
  orderby?: 'created_at';
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Get Comments for a Post
// -----------------------------------------------------------------------------

export async function getComments(postId: number, options: GetCommentsOptions = {}) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || 50,
    ...(options.parent_id !== undefined && { parent_id: options.parent_id }),
    ...(options.orderby && { orderby: options.orderby }),
    ...(options.order && { order: options.order }),
  };
  
  return get<CommentsResponse>(ENDPOINTS.POST_COMMENTS(postId), params);
}

// -----------------------------------------------------------------------------
// Get Single Comment by ID
// -----------------------------------------------------------------------------

export async function getComment(commentId: number) {
  return get<{ data: Comment }>(`/comments/${commentId}`);
}

// -----------------------------------------------------------------------------
// Create a Comment
// -----------------------------------------------------------------------------
// FIXED: Web app sends 'comment' not 'message'!
// FIXED: Added media_images support
// -----------------------------------------------------------------------------

export interface CreateCommentData {
  comment: string;  // FIXED: Web app uses 'comment' not 'message'
  content_type?: 'text' | 'markdown' | 'html';
  parent_id?: number;
  media_images?: Array<{
    url: string;
    type: string;
    width: number;
    height: number;
    provider: string;
  }>;
}

export async function createComment(postId: number, data: CreateCommentData) {
  // Build request matching EXACTLY what web app sends
  const requestData: Record<string, any> = {
    comment: data.comment,  // FIXED: 'comment' not 'message'
    meta: null,             // Web app sends this
  };
  
  // Optional fields
  if (data.content_type) {
    requestData.content_type = data.content_type;
  }
  
  if (data.parent_id) {
    requestData.parent_id = data.parent_id;
  }
  
  // Media images at top level (like feeds)
  if (data.media_images && data.media_images.length > 0) {
    requestData.media_images = data.media_images;
  }
  
  if (__DEV__) console.log('[CommentsAPI] Creating comment with:', JSON.stringify(requestData, null, 2));
  
  return post<CreateCommentResponse>(ENDPOINTS.POST_COMMENTS(postId), requestData);
}

// -----------------------------------------------------------------------------
// Update a Comment
// -----------------------------------------------------------------------------
// FIXED: Use 'comment' not 'message' to match web app

export interface UpdateCommentData {
  comment: string;  // FIXED: Use 'comment' not 'message'
  content_type?: 'text' | 'markdown' | 'html';
}

export async function updateComment(postId: number, commentId: number, data: UpdateCommentData) {
  if (__DEV__) console.log('[CommentsAPI] Updating comment:', { postId, commentId, data });
  
  return post<{ message: string; data: Comment }>(
    `${ENDPOINTS.POST_COMMENTS(postId)}/${commentId}`,
    data
  );
}

// -----------------------------------------------------------------------------
// Delete a Comment
// -----------------------------------------------------------------------------

export async function deleteComment(postId: number, commentId: number) {
  return del<{ message: string }>(`${ENDPOINTS.POST_COMMENTS(postId)}/${commentId}`);
}

// -----------------------------------------------------------------------------
// React to a Comment
// -----------------------------------------------------------------------------
// FIXED: Web app sends {state: 1} to toggle reaction on/off
// state: 1 = add reaction, state: 0 = remove reaction (toggle)

export async function reactToComment(
  postId: number,
  commentId: number,
  hasReacted: boolean = false,
  reactionType: ReactionType = 'like'
) {
  // Web app format: {state: 1} to react, {state: 0} to unreact
  const payload = {
    state: hasReacted ? 0 : 1,
  };

  // Send reaction type header so tb-multi-reactions plugin can track it
  const headers: Record<string, string> = {
    'X-TBC-Reaction-Type': reactionType,
  };

  if (__DEV__) console.log('[CommentsAPI] Reacting to comment:', { postId, commentId, payload, reactionType });

  return post<ReactResponse>(`${ENDPOINTS.POST_COMMENTS(postId)}/${commentId}/reactions`, payload, undefined, headers);
}

// -----------------------------------------------------------------------------
// Pin/Unpin a Comment (mod/admin only)
// -----------------------------------------------------------------------------
// PATCH /feeds/{postId}/comments/{commentId} with { is_sticky: 1|0 }
// FC 2.2.01+ — only top-level comments, auto-unpins previous pinned comment

export async function pinComment(postId: number, commentId: number, pin: boolean) {
  return patch<{ comment: Comment; message: string }>(
    `${ENDPOINTS.POST_COMMENTS(postId)}/${commentId}`,
    { is_sticky: pin ? 1 : 0 }
  );
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const commentsApi = {
  getComments,
  getComment,
  createComment,
  updateComment,
  deleteComment,
  reactToComment,
  pinComment,
};

export default commentsApi;
