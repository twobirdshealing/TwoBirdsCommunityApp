// =============================================================================
// BLOG API - WordPress REST API for blog posts and comments
// =============================================================================
// Uses WP REST API (/wp-json/wp/v2) via centralized client.
// JWT auth + silent refresh handled automatically by client.ts.
// =============================================================================

import { WP_REST_URL, WP_ENDPOINTS, DEFAULT_PER_PAGE } from '@/constants/config';
import {
  WPPost,
  WPComment,
  WPPostsResponse,
  WPCommentsResponse,
  WPCategory,
  CreateWPCommentData,
} from '@/types/blog';
import { request, type ApiResponseWithHeaders } from './client';
import type { ApiError } from '@/types/api';

// -----------------------------------------------------------------------------
// WP REST Request Helper
// -----------------------------------------------------------------------------
// Thin wrapper over the centralized client with WP_REST_URL base.
// Always includes response headers (needed for X-WP-Total pagination).
// JWT retry is handled automatically by client.ts.
// -----------------------------------------------------------------------------

type WPRequestResult<T> = { success: true; data: T; headers: Headers };
type WPRequestError = { success: false; error: ApiError };

async function wpRequest<T>(
  endpoint: string,
  options: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; params?: Record<string, any>; body?: any } = {}
): Promise<WPRequestResult<T> | WPRequestError> {
  return request<T>(endpoint, {
    method: options.method || 'GET',
    params: options.params,
    body: options.body,
    baseUrl: WP_REST_URL,
    includeHeaders: true,
  }) as Promise<WPRequestResult<T> | WPRequestError>;
}

// -----------------------------------------------------------------------------
// Get Blog Posts (list)
// -----------------------------------------------------------------------------

export interface GetBlogPostsOptions {
  page?: number;
  per_page?: number;
  categories?: number;
  search?: string;
}

export async function getBlogPosts(
  options: GetBlogPostsOptions = {}
): Promise<{ success: true; data: WPPostsResponse } | WPRequestError> {
  const params: Record<string, any> = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
    _embed: '',
    ...(options.categories && { categories: options.categories }),
    ...(options.search && { search: options.search }),
  };

  const result = await wpRequest<WPPost[]>(WP_ENDPOINTS.POSTS, { params });

  if (!result.success) return result;

  const total = parseInt(result.headers.get('X-WP-Total') || '0', 10);
  const totalPages = parseInt(result.headers.get('X-WP-TotalPages') || '0', 10);

  return {
    success: true,
    data: {
      posts: result.data,
      meta: { total, totalPages },
    },
  };
}

// -----------------------------------------------------------------------------
// Get Single Blog Post
// -----------------------------------------------------------------------------

export async function getBlogPost(
  id: number
): Promise<{ success: true; data: WPPost } | WPRequestError> {
  const result = await wpRequest<WPPost>(WP_ENDPOINTS.POST_BY_ID(id), {
    params: { _embed: '' },
  });

  if (!result.success) return result;
  return { success: true, data: result.data };
}

// -----------------------------------------------------------------------------
// Get Blog Post by Slug
// -----------------------------------------------------------------------------

export async function getBlogPostBySlug(
  slug: string
): Promise<{ success: true; data: WPPost } | WPRequestError> {
  const result = await wpRequest<WPPost[]>(WP_ENDPOINTS.POSTS, {
    params: { slug, _embed: '' },
  });

  if (!result.success) return result;
  if (result.data.length === 0) {
    return {
      success: false,
      error: { code: 'not_found', message: 'Post not found', data: { status: 404 } },
    };
  }
  return { success: true, data: result.data[0] };
}

// -----------------------------------------------------------------------------
// Get Categories
// -----------------------------------------------------------------------------

export async function getBlogCategories(): Promise<
  { success: true; data: WPCategory[] } | WPRequestError
> {
  const result = await wpRequest<WPCategory[]>(WP_ENDPOINTS.CATEGORIES, {
    params: { per_page: 100, hide_empty: true },
  });

  if (!result.success) return result;
  return { success: true, data: result.data };
}

// -----------------------------------------------------------------------------
// Get Comments for a Post
// -----------------------------------------------------------------------------

export interface GetBlogCommentsOptions {
  page?: number;
  per_page?: number;
}

export async function getBlogComments(
  postId: number,
  options: GetBlogCommentsOptions = {}
): Promise<{ success: true; data: WPCommentsResponse } | WPRequestError> {
  const result = await wpRequest<WPComment[]>(WP_ENDPOINTS.COMMENTS, {
    params: {
      post: postId,
      page: options.page || 1,
      per_page: options.per_page || 50,
      order: 'asc',
    },
  });

  if (!result.success) return result;

  const total = parseInt(result.headers.get('X-WP-Total') || '0', 10);
  const totalPages = parseInt(result.headers.get('X-WP-TotalPages') || '0', 10);

  return {
    success: true,
    data: {
      comments: result.data,
      meta: { total, totalPages },
    },
  };
}

// -----------------------------------------------------------------------------
// Create a Comment (auth required)
// -----------------------------------------------------------------------------

export async function createBlogComment(
  data: CreateWPCommentData
): Promise<{ success: true; data: WPComment } | WPRequestError> {
  const result = await wpRequest<WPComment>(WP_ENDPOINTS.COMMENTS, {
    method: 'POST',
    body: {
      post: data.post,
      content: data.content,
      parent: data.parent || 0,
    },
  });

  if (!result.success) return result;
  return { success: true, data: result.data };
}

// -----------------------------------------------------------------------------
// Update a Comment (auth required, owner only)
// -----------------------------------------------------------------------------

export async function updateBlogComment(
  commentId: number,
  content: string
): Promise<{ success: true; data: WPComment } | WPRequestError> {
  const result = await wpRequest<WPComment>(`${WP_ENDPOINTS.COMMENTS}/${commentId}`, {
    method: 'POST',
    body: { content },
  });

  if (!result.success) return result;
  return { success: true, data: result.data };
}

// -----------------------------------------------------------------------------
// Delete a Comment (auth required, owner only)
// -----------------------------------------------------------------------------

export async function deleteBlogComment(
  commentId: number
): Promise<{ success: true; data: WPComment } | WPRequestError> {
  const result = await wpRequest<WPComment>(`${WP_ENDPOINTS.COMMENTS}/${commentId}`, {
    method: 'DELETE',
    params: { force: true },
  });

  if (!result.success) return result;
  return { success: true, data: result.data };
}

// -----------------------------------------------------------------------------
// Get WP User Slug by ID (for navigating comment authors to profile)
// -----------------------------------------------------------------------------

export async function getWpUserSlug(
  userId: number
): Promise<string | null> {
  const result = await wpRequest<{ slug: string }>(`/users/${userId}`, {
    params: { _fields: 'slug' },
  });

  if (!result.success) return null;
  return result.data.slug || null;
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const blogApi = {
  getBlogPosts,
  getBlogPost,
  getBlogPostBySlug,
  getBlogCategories,
  getBlogComments,
  createBlogComment,
  updateBlogComment,
  deleteBlogComment,
  getWpUserSlug,
};

export default blogApi;
