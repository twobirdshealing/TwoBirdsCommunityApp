// =============================================================================
// FEEDS API - All feed-related API calls
// =============================================================================
// This service handles fetching, creating, and managing feed posts.
// Uses the base API client for HTTP requests.
// =============================================================================

import { get, post, del } from './client';
import { ENDPOINTS, DEFAULT_PER_PAGE } from '@/constants/config';
import { Feed, FeedsResponse, FeedDetailResponse, ReactResponse, ReactionType } from '@/types';

// -----------------------------------------------------------------------------
// Request Options
// -----------------------------------------------------------------------------

export interface GetFeedsOptions {
  page?: number;
  per_page?: number;
  space?: string;         // Filter by space slug
  user_id?: number;       // Filter by author
  search?: string;        // Search in title/content
  topic_slug?: string;    // Filter by topic
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
// Create a New Feed Post (Phase 2)
// -----------------------------------------------------------------------------

export interface CreateFeedData {
  message: string;
  title?: string;
  space_id?: number;
  content_type?: 'text' | 'markdown' | 'html';
  privacy?: 'public' | 'private';
  status?: 'published' | 'draft';
  featured_image?: string;
  scheduled_at?: string;
  meta?: Record<string, any>;
}

export async function createFeed(data: CreateFeedData) {
  return post<{ message: string; data: Feed }>(ENDPOINTS.FEEDS, data);
}

// -----------------------------------------------------------------------------
// Update a Feed Post (Phase 2)
// -----------------------------------------------------------------------------

export async function updateFeed(id: number, data: Partial<CreateFeedData>) {
  return post<{ message: string; data: Feed }>(`${ENDPOINTS.FEEDS}/${id}`, data);
}

// -----------------------------------------------------------------------------
// Delete a Feed Post (Phase 2)
// -----------------------------------------------------------------------------

export async function deleteFeed(id: number) {
  return del<{ message: string }>(`${ENDPOINTS.FEEDS}/${id}`);
}

// -----------------------------------------------------------------------------
// React to a Feed (like, love, etc.)
// -----------------------------------------------------------------------------

export async function reactToFeed(feedId: number, type: ReactionType) {
  return post<ReactResponse>(ENDPOINTS.FEED_REACT(feedId), { type });
}

// -----------------------------------------------------------------------------
// Get Reactions for a Feed
// -----------------------------------------------------------------------------

export async function getFeedReactions(feedId: number, type?: ReactionType) {
  const params = type ? { type } : {};
  return get<{ reactions: any[] }>(`${ENDPOINTS.FEEDS}/${feedId}/reactions`, params);
}

// -----------------------------------------------------------------------------
// Export as object for convenience
// -----------------------------------------------------------------------------

export const feedsApi = {
  getFeeds,
  getFeedById,
  getFeedBySlug,
  createFeed,
  updateFeed,
  deleteFeed,
  reactToFeed,
  getFeedReactions,
};

export default feedsApi;
