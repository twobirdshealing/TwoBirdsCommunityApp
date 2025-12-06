// =============================================================================
// COMMENTS API - All comment-related API calls
// =============================================================================
// This service handles fetching and managing comments on feeds.
// =============================================================================

import { get, post, del } from './client';
import { ENDPOINTS, DEFAULT_PER_PAGE } from '@/constants/config';
import { Comment, CommentsResponse, CreateCommentResponse } from '@/types';

// -----------------------------------------------------------------------------
// Request Options
// -----------------------------------------------------------------------------

export interface GetCommentsOptions {
  page?: number;
  per_page?: number;
  parent_id?: number;     // 0 for top-level, or parent comment ID for replies
  orderby?: 'created_at';
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Get Comments for a Feed
// -----------------------------------------------------------------------------

export async function getComments(feedId: number, options: GetCommentsOptions = {}) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || 50,  // Comments usually load more
    ...(options.parent_id !== undefined && { parent_id: options.parent_id }),
    ...(options.orderby && { orderby: options.orderby }),
    ...(options.order && { order: options.order }),
  };
  
  return get<CommentsResponse>(ENDPOINTS.FEED_COMMENTS(feedId), params);
}

// -----------------------------------------------------------------------------
// Get Single Comment by ID
// -----------------------------------------------------------------------------

export async function getComment(commentId: number) {
  return get<{ data: Comment }>(`/comments/${commentId}`);
}

// -----------------------------------------------------------------------------
// Create a Comment (Phase 2)
// -----------------------------------------------------------------------------

export interface CreateCommentData {
  message: string;
  content_type?: 'text' | 'markdown' | 'html';
  parent_id?: number;  // For replies to other comments
}

export async function createComment(feedId: number, data: CreateCommentData) {
  return post<CreateCommentResponse>(ENDPOINTS.FEED_COMMENTS(feedId), data);
}

// -----------------------------------------------------------------------------
// Update a Comment (Phase 2)
// -----------------------------------------------------------------------------

export async function updateComment(feedId: number, commentId: number, data: Partial<CreateCommentData>) {
  return post<{ message: string; data: Comment }>(
    `${ENDPOINTS.FEED_COMMENTS(feedId)}/${commentId}`,
    data
  );
}

// -----------------------------------------------------------------------------
// Delete a Comment (Phase 2)
// -----------------------------------------------------------------------------

export async function deleteComment(feedId: number, commentId: number) {
  return del<{ message: string }>(`${ENDPOINTS.FEED_COMMENTS(feedId)}/${commentId}`);
}

// -----------------------------------------------------------------------------
// React to a Comment
// -----------------------------------------------------------------------------

export async function reactToComment(feedId: number, commentId: number, type: string) {
  return post<any>(`${ENDPOINTS.FEED_COMMENTS(feedId)}/${commentId}/reactions`, { type });
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
};

export default commentsApi;
