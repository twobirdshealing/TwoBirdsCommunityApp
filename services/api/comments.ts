// =============================================================================
// COMMENTS API - All comment-related API calls
// =============================================================================
// FIXED: Use 'comment' not 'message' - matches what web app sends
// FIXED: Add media_images support for image comments
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
  parent_id?: number;
  orderby?: 'created_at';
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Get Comments for a Feed
// -----------------------------------------------------------------------------

export async function getComments(feedId: number, options: GetCommentsOptions = {}) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || 50,
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

export async function createComment(feedId: number, data: CreateCommentData) {
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
  
  console.log('[CommentsAPI] Creating comment with:', JSON.stringify(requestData, null, 2));
  
  return post<CreateCommentResponse>(ENDPOINTS.FEED_COMMENTS(feedId), requestData);
}

// -----------------------------------------------------------------------------
// Update a Comment
// -----------------------------------------------------------------------------

export async function updateComment(feedId: number, commentId: number, data: Partial<CreateCommentData>) {
  return post<{ message: string; data: Comment }>(
    `${ENDPOINTS.FEED_COMMENTS(feedId)}/${commentId}`,
    data
  );
}

// -----------------------------------------------------------------------------
// Delete a Comment
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
