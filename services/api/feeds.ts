// =============================================================================
// FEEDS API - All feed-related API calls
// =============================================================================
// FIXED: Send 'space' (slug) instead of 'space_id' (number)
// Native web app uses: {"space": "book-club", ...} NOT {"space_id": 50, ...}
// ADDED: getWelcomeBanner() for welcome banner feature
// =============================================================================

import { DEFAULT_PER_PAGE, ENDPOINTS, TBC_MR_URL } from '@/constants/config';
import { Feed, FeedDetailResponse, FeedsResponse, ReactResponse, ReactionType, SurveyConfig, WelcomeBannerResponse } from '@/types/feed';
import { del, get, patch, post, request } from './client';

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
// Get oEmbed Data for URL
// -----------------------------------------------------------------------------
// GET /feeds/oembed?url=... - returns metadata for video/link embeds

export interface OembedData {
  title: string;
  author_name?: string;
  type: string;
  provider: string;
  content_type: string;
  url: string;
  html?: string;
  image?: string;
}

export interface OembedResponse {
  oembed: OembedData;
}

export async function getOembed(url: string) {
  return get<OembedResponse>(`${ENDPOINTS.FEEDS}/oembed`, { url });
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
  // Media - web app uses media_images array for images
  media_images?: Array<{
    url: string;
    type: string;
    width: number;
    height: number;
    provider: string;
  }>;
  // Media - for video embeds (oembed)
  media?: {
    type: 'oembed';
    url: string;
  };
  meta?: Record<string, any>;
  // Survey/poll data
  survey?: {
    type: 'single_choice' | 'multi_choice';
    options: { label: string; slug: string }[];
    end_date: string;
  };
}

export async function createFeed(data: CreateFeedData) {
  // Build request matching EXACTLY what web app sends
  const requestData: Record<string, any> = {
    type: data.type || 'text',
    message: data.message,
    media: null,           // Web app sends this (will be overwritten if video attached)
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

  // Video embed (oembed) - replaces null media field
  if (data.media) {
    requestData.media = data.media;
  }

  // Meta (for GIF attachments via media_preview)
  if (data.meta) {
    requestData.meta = data.meta;
  }

  // Survey/poll data
  if (data.survey) {
    requestData.survey = data.survey;
  }

  if (__DEV__) console.log('[FeedsAPI] Creating feed with:', JSON.stringify(requestData, null, 2));

  return post<{ feed: Feed }>(ENDPOINTS.FEEDS, requestData);
}

// -----------------------------------------------------------------------------
// Update a Feed Post
// -----------------------------------------------------------------------------

export async function updateFeed(id: number, data: Partial<CreateFeedData>) {
  return post<{ feed: Feed }>(`${ENDPOINTS.FEEDS}/${id}`, data);
}

// -----------------------------------------------------------------------------
// Toggle Sticky/Pin Status
// -----------------------------------------------------------------------------
// POST requires 'message' field even for partial updates
// PATCH should allow partial updates without all required fields
// Web app sends: {is_sticky: 1, query_timestamp: ...}

export async function toggleSticky(id: number, isSticky: boolean) {
  if (__DEV__) console.log('[FeedsAPI] toggleSticky using PATCH:', { id, isSticky: isSticky ? 1 : 0 });
  
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
  // Always send 'like' to FC — FC only understands 'like' as a reaction type.
  // The actual multi-reaction type is sent via X-TBC-Reaction-Type header.
  const payload: { react_type: string; remove?: boolean } = {
    react_type: 'like'
  };

  if (hasUserReact) {
    payload.remove = true;
  }

  // Send reaction type header so tb-multi-reactions plugin can track it
  const headers: Record<string, string> = {
    'X-TBC-Reaction-Type': type,
  };

  return post<ReactResponse>(ENDPOINTS.FEED_REACT(feedId), payload, undefined, headers);
}

// -----------------------------------------------------------------------------
// Swap Reaction Type (change existing reaction to different type)
// -----------------------------------------------------------------------------
// Uses tbc-multi-reactions plugin REST endpoint

export async function swapReactionType(
  objectId: number,
  objectType: 'feed' | 'comment',
  reactionType: ReactionType
) {
  return request('/swap', {
    method: 'POST',
    body: { object_id: objectId, object_type: objectType, reaction_type: reactionType },
    baseUrl: TBC_MR_URL,
  });
}

// -----------------------------------------------------------------------------
// Get Reaction Breakdown with Users
// -----------------------------------------------------------------------------
// Uses tbc-multi-reactions plugin REST endpoint

export interface BreakdownUser {
  user_id: number;
  display_name: string;
  avatar: string;
  user_url?: string;
  is_verified?: number;
  badge_slugs?: string[];
}

export interface BreakdownItem {
  type: ReactionType;
  emoji: string;
  icon_url?: string | null;
  name: string;
  count: number;
  color: string;
  users: BreakdownUser[];
  has_more?: boolean;
}

export interface BreakdownResponse {
  breakdown: BreakdownItem[];
  total: number;
}

export async function getReactionBreakdownUsers(
  objectType: 'feed' | 'comment',
  objectId: number
) {
  return request<BreakdownResponse>(`/breakdown/${objectType}/${objectId}/users`, {
    baseUrl: TBC_MR_URL,
  });
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

/** Bookmarks response — shape varies between FC versions */
export interface BookmarksResponse {
  feeds?: FeedsResponse['feeds'] | Feed[];
  data?: Feed[];
  [key: string]: unknown;
}

export async function getBookmarks(options: GetBookmarksOptions = {}) {
  const params = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
    ...(options.order_by_type && { order_by_type: options.order_by_type }),
  };

  return get<BookmarksResponse>(`${ENDPOINTS.FEEDS}/bookmarks`, params);
}

// -----------------------------------------------------------------------------
// Get Reactions for a Feed
// -----------------------------------------------------------------------------

export async function getFeedReactions(feedId: number, type?: ReactionType) {
  const params = type ? { type } : {};
  return get<{ reactions: Feed['reactions'] }>(ENDPOINTS.FEED_REACTIONS(feedId), params);
}

// -----------------------------------------------------------------------------
// Cast Survey Vote
// -----------------------------------------------------------------------------
// POST /feeds/{id}/apps/survey-vote - returns updated survey_config

export interface SurveyVoteResponse {
  survey_config: SurveyConfig;
}

export async function castSurveyVote(feedId: number, voteIndexes: string[]) {
  return post<SurveyVoteResponse>(ENDPOINTS.SURVEY_VOTE(feedId), { vote_indexes: voteIndexes });
}

// -----------------------------------------------------------------------------
// Get Survey Voters for an Option
// -----------------------------------------------------------------------------

export async function getSurveyVoters(feedId: number, optionSlug: string) {
  return get<{ voters: Array<{ user_id: number; display_name: string; avatar: string }> }>(
    ENDPOINTS.SURVEY_VOTERS(feedId, optionSlug)
  );
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const feedsApi = {
  getFeeds,
  getFeedById,
  getFeedBySlug,
  getWelcomeBanner,
  getOembed,
  createFeed,
  updateFeed,
  toggleSticky,
  deleteFeed,
  reactToFeed,
  swapReactionType,
  toggleBookmark,
  getBookmarks,
  getFeedReactions,
  getReactionBreakdownUsers,
  castSurveyVote,
  getSurveyVoters,
};

export default feedsApi;
