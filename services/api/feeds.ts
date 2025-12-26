// =============================================================================
// FEEDS API - All feed-related API calls
// =============================================================================
// FIXED: Send 'space' (slug) instead of 'space_id' (number)
// Native web app uses: {"space": "book-club", ...} NOT {"space_id": 50, ...}
// ADDED: getWelcomeBanner() for welcome banner feature
// =============================================================================

import { DEFAULT_PER_PAGE, ENDPOINTS } from '@/constants/config';
import { Feed, FeedDetailResponse, FeedsResponse, ReactResponse, ReactionType, WelcomeBannerResponse } from '@/types';
import { del, get, patch, post } from './client';

// -----------------------------------------------------------------------------
// Request Options
// -----------------------------------------------------------------------------

export interface GetFeedsOptions {
  page?: number;
  per_page?: number;
  space?: string;
  user_id?: number;
  search?: string;
  topic_slug?: string;
  order_by_type?: 'recent' | 'popular';
  disable_sticky?: boolean;
}

// -----------------------------------------------------------------------------
// Get All Feeds
// -----------------------------------------------------------------------------

export async function getFeeds(options: GetFeedsOptions = {}) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
    ...(options.space && { space: options.space }),
    ...(options.user_id && { user_id: options.user_id }),
    ...(options.search && { search: options.search }),
    ...(options.topic_slug && { topic_slug: options.topic_slug }),
    ...(options.order_by_type && { order_by_type: options.order_by_type }),
    ...(options.disable_sticky && { disable_sticky: 'yes' }),
  };
  
  return get<FeedsResponse>(ENDPOINTS.FEEDS, params);
}

// -----------------------------------------------------------------------------
// Get Single Feed by ID
// -----------------------------------------------------------------------------

export async function getFeedById(id: number) {
  return get<FeedDetailResponse>(ENDPOINTS.FEED_BY_ID(id));
}

// -----------------------------------------------------------------------------
// Get Single Feed by Slug
// -----------------------------------------------------------------------------

export async function getFeedBySlug(slug: string) {
  return get<FeedDetailResponse>(ENDPOINTS.FEED_BY_SLUG(slug));
}

// -----------------------------------------------------------------------------
// Get Welcome Banner
// -----------------------------------------------------------------------------
// GET /feeds/welcome-banner - returns welcome banner configuration

export async function getWelcomeBanner() {
  return get<WelcomeBannerResponse>(ENDPOINTS.WELCOME_BANNER);
}

// -----------------------------------------------------------------------------
// Create a New Feed Post
// -----------------------------------------------------------------------------
// FIXED: Use 'space' (slug) instead of 'space_id'
// This matches what the native web app sends
// -----------------------------------------------------------------------------

export interface CreateFeedData {
  message: string;
  title?: string;
  space?: string;  // SLUG, not ID!
  type?: 'text' | 'feed';
  content_type?: 'text' | 'markdown' | 'html';
  privacy?: 'public' | 'private';
  status?: 'published' | 'draft';
  featured_image?: string;
  scheduled_at?: string;
  // Media - web app uses media_images array
  media_images?: Array<{
    url: string;
    type: string;
    width: number;
    height: number;
    provider: string;
  }>;
  meta?: Record<string, any>;
}

export async function createFeed(data: CreateFeedData) {
  // Build request matching EXACTLY what web app sends
  const requestData: Record<string, any> = {
    type: data.type || 'text',
    message: data.message,
    media: null,           // Web app sends this
    media_image: '',       // Web app sends this
    topic_ids: [],         // Web app sends this
    send_announcement_email: 'no',  // Web app sends this
  };
  
  // CRITICAL: Use 'space' (slug) not 'space_id'
  if (data.space) {
    requestData.space = data.space;
  }
  
  // Optional fields
  if (data.title) {
    requestData.title = data.title;
  }
  if (data.content_type) {
    requestData.content_type = data.content_type;
  }
  if (data.privacy) {
    requestData.privacy = data.privacy;
  }
  if (data.status) {
    requestData.status = data.status;
  }
  
  // CRITICAL: media_images at TOP LEVEL - EXACT format from web app
  if (data.media_images && data.media_images.length > 0) {
    requestData.media_images = data.media_images;
  }
  
  console.log('[FeedsAPI] Creating feed with:', JSON.stringify(requestData, null, 2));
  
  return post<{ message: string; data: Feed }>(ENDPOINTS.FEEDS, requestData);
}

// -----------------------------------------------------------------------------
// Update a Feed Post
// -----------------------------------------------------------------------------

export async function updateFeed(id: number, data: Partial<CreateFeedData>) {
  return post<{ message: string; data: Feed }>(`${ENDPOINTS.FEEDS}/${id}`, data);
}

// -----------------------------------------------------------------------------
// Toggle Sticky/Pin Status
// -----------------------------------------------------------------------------
// POST requires 'message' field even for partial updates
// PATCH should allow partial updates without all required fields
// Web app sends: {is_sticky: 1, query_timestamp: ...}

export async function toggleSticky(id: number, isSticky: boolean) {
  console.log('[FeedsAPI] toggleSticky using PATCH:', { id, isSticky: isSticky ? 1 : 0 });
  
  // Use PATCH for partial update (doesn't require all fields)
  return patch<{ message: string; data: Feed }>(`${ENDPOINTS.FEEDS}/${id}`, {
    is_sticky: isSticky ? 1 : 0,
    query_timestamp: Date.now(),
  });
}

// -----------------------------------------------------------------------------
// Delete a Feed Post
// -----------------------------------------------------------------------------

export async function deleteFeed(id: number) {
  return del<{ message: string }>(`${ENDPOINTS.FEEDS}/${id}`);
}

// -----------------------------------------------------------------------------
// React to a Feed (like, love, etc.)
// -----------------------------------------------------------------------------

export async function reactToFeed(
  feedId: number, 
  type: ReactionType, 
  hasUserReact: boolean = false
) {
  const payload: { react_type: string; remove?: boolean } = { 
    react_type: type 
  };
  
  if (hasUserReact) {
    payload.remove = true;
  }
  
  return post<ReactResponse>(ENDPOINTS.FEED_REACT(feedId), payload);
}

// -----------------------------------------------------------------------------
// Bookmark a Feed
// -----------------------------------------------------------------------------

export async function toggleBookmark(feedId: number, isBookmarked: boolean) {
  const payload: { react_type: string; remove?: boolean } = { 
    react_type: 'bookmark' 
  };
  
  if (isBookmarked) {
    payload.remove = true;
  }
  
  return post<ReactResponse>(ENDPOINTS.FEED_REACT(feedId), payload);
}

// -----------------------------------------------------------------------------
// Get Bookmarked Feeds
// -----------------------------------------------------------------------------
// GET /feeds/bookmarks - returns user's saved posts

export interface GetBookmarksOptions {
  page?: number;
  per_page?: number;
  order_by_type?: 'latest' | 'oldest' | 'new_activity' | 'likes' | 'popular';
}

export async function getBookmarks(options: GetBookmarksOptions = {}) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
    ...(options.order_by_type && { order_by_type: options.order_by_type }),
  };
  
  return get<any>(`${ENDPOINTS.FEEDS}/bookmarks`, params);
}

// -----------------------------------------------------------------------------
// Get Reactions for a Feed
// -----------------------------------------------------------------------------

export async function getFeedReactions(feedId: number, type?: ReactionType) {
  const params = type ? { type } : {};
  return get<any>(ENDPOINTS.FEED_REACTIONS(feedId), params);
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const feedsApi = {
  getFeeds,
  getFeedById,
  getFeedBySlug,
  getWelcomeBanner,
  createFeed,
  updateFeed,
  toggleSticky,
  deleteFeed,
  reactToFeed,
  toggleBookmark,
  getBookmarks,
  getFeedReactions,
};

export default feedsApi;
