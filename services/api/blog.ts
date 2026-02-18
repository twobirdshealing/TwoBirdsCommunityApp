// =============================================================================
// BLOG API - WordPress REST API for blog posts and comments
// =============================================================================
// Uses WP REST API (/wp-json/wp/v2) with JWT auth for comment creation.
// Reuses auth token/refresh logic from services/auth.ts.
// =============================================================================

import { WP_REST_URL, WP_ENDPOINTS, DEFAULT_PER_PAGE } from '@/constants/config';
import { getAuthToken, silentRefresh, clearAuth } from '@/services/auth';
import {
  WPPost,
  WPComment,
  WPPostsResponse,
  WPCommentsResponse,
  WPCategory,
  CreateWPCommentData,
} from '@/types/blog';

// -----------------------------------------------------------------------------
// Debug
// -----------------------------------------------------------------------------

const DEBUG = __DEV__;
function log(...args: any[]) {
  if (DEBUG) console.log('[BlogAPI]', ...args);
}

// -----------------------------------------------------------------------------
// WP REST Request Helper
// -----------------------------------------------------------------------------
// Mirrors client.ts pattern but uses WP_REST_URL base and returns headers
// (needed for X-WP-Total / X-WP-TotalPages pagination).
// -----------------------------------------------------------------------------

interface WPRequestResult<T> {
  success: true;
  data: T;
  headers: Headers;
}

interface WPRequestError {
  success: false;
  error: { code: string; message: string; data?: any };
}

async function wpRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    params?: Record<string, any>;
    body?: any;
    _isRetry?: boolean;
  } = {}
): Promise<WPRequestResult<T> | WPRequestError> {
  const { method = 'GET', params, body, _isRetry = false } = options;

  // Build URL with query params
  let url = `${WP_REST_URL}${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
  }

  log(`${method} ${url}`);

  // Auth header (optional for public GET, required for POST)
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await response.json();

    if (!response.ok) {
      // Handle JWT expiration (same pattern as client.ts)
      const isJwtExpired =
        response.status === 401 ||
        (response.status === 403 &&
          (data?.code === 'jwt_auth_invalid_token' ||
            data?.code === 'jwt_auth_expired_token' ||
            data?.code === 'rest_forbidden'));

      if (isJwtExpired && !_isRetry) {
        log('JWT expired, attempting silent refresh...');
        const refreshed = await silentRefresh();
        if (refreshed) {
          log('Token refreshed, retrying...');
          return wpRequest<T>(endpoint, { ...options, _isRetry: true });
        }
        await clearAuth();
      } else if (isJwtExpired && _isRetry) {
        await clearAuth();
      }

      return {
        success: false,
        error: {
          code: data?.code || 'wp_error',
          message: data?.message || 'Request failed',
          data: data?.data,
        },
      };
    }

    return { success: true, data: data as T, headers: response.headers };
  } catch (error) {
    console.error('[BlogAPI] Network error:', error);
    return {
      success: false,
      error: {
        code: 'network_error',
        message: error instanceof Error ? error.message : 'Network request failed',
      },
    };
  }
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
      error: { code: 'not_found', message: 'Post not found' },
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
