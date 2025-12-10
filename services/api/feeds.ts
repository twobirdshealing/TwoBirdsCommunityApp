// =============================================================================
// FEEDS API - All feed-related API calls
// =============================================================================
// This service handles fetching, creating, and managing feed posts.
// Uses the base API client for HTTP requests.
// =============================================================================

import { DEFAULT_PER_PAGE, ENDPOINTS } from '@/constants/config';
import { Feed, FeedDetailResponse, FeedsResponse, ReactResponse, ReactionType } from '@/types';
import { del, get, post } from './client';

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
  
  const response = await get<FeedsResponse>(ENDPOINTS.FEEDS, params);
  
  // DEBUG: Log the first 5 feeds to see media structure
  if (response.success && response.data?.feeds?.data) {
    const feeds = response.data.feeds.data.slice(0, 5);
    console.log('\n========== DEBUG: FEED MEDIA STRUCTURE ==========');
    feeds.forEach((feed: Feed, index: number) => {
      console.log(`\n[Feed ${index + 1}] ID: ${feed.id}`);
      console.log(`  Title: ${feed.title || '(no title)'}`);
      console.log(`  Message (first 100 chars): ${feed.message?.substring(0, 100) || '(empty)'}...`);
      console.log(`  featured_image: ${feed.featured_image || 'null'}`);
      console.log(`  content_type: ${feed.content_type}`);
      console.log(`  meta:`, JSON.stringify(feed.meta, null, 2));
    });
    console.log('\n========== END DEBUG ==========\n');
  }
  
  return response;
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