// =============================================================================
// CONFIG - Central configuration for the app
// =============================================================================
// This file contains all the settings that might change between environments
// (development, staging, production) or need to be updated in one place.
//
// ⚠️  SECURITY NOTE: In a real production app, you would:
//     1. Use environment variables (process.env.API_URL)
//     2. Never commit credentials to git
//     3. Use a proper auth system (JWT tokens from login)
//
// For now, we're using hardcoded values for development simplicity.
// =============================================================================

// -----------------------------------------------------------------------------
// API Configuration
// -----------------------------------------------------------------------------

// The base URL for all Fluent Community API calls
// This is your WordPress site with Fluent Community installed
export const API_URL = 'http://staging.twobirdschurch.com/wp-json/fluent-community/v2';
// Your WordPress site URL (for non-API links, avatars, etc.)
export const SITE_URL = 'http://staging.twobirdschurch.com';

// -----------------------------------------------------------------------------
// Authentication (TEMPORARY - will be replaced with proper login)
// -----------------------------------------------------------------------------

// WordPress username with API access
export const API_USERNAME = 'dfwaya';

// WordPress Application Password (NOT your regular password)
// Generate at: WordPress Dashboard → Users → Profile → Application Passwords
export const API_PASSWORD = 'ujkF qKio WyOH AEDK GtXG YeCG';

// -----------------------------------------------------------------------------
// App Settings
// -----------------------------------------------------------------------------

// App display name
export const APP_NAME = 'Two Birds Community';

// Number of items to load per page
export const DEFAULT_PER_PAGE = 20;

// How long to cache data (in milliseconds)
export const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// -----------------------------------------------------------------------------
// Feature Flags (enable/disable features)
// -----------------------------------------------------------------------------

export const FEATURES = {
  // Phase 1 - Currently building
  FEED_VIEW: true,
  FEED_DETAIL: true,
  COMMENTS_VIEW: true,
  SPACES_VIEW: true,
  PROFILE_VIEW: true,
  REACTIONS: true,
  
  // Phase 2 - Coming later (greyed out in UI)
  CREATE_POST: false,
  CREATE_COMMENT: false,
  NOTIFICATIONS: false,
  
  // Phase 3 - Future
  USER_AUTH: false,
  MESSAGES: false,
  PUSH_NOTIFICATIONS: false,
};

// -----------------------------------------------------------------------------
// API Endpoints (for reference)
// -----------------------------------------------------------------------------

export const ENDPOINTS = {
  // Feeds
  FEEDS: '/feeds',
  FEED_BY_ID: (id: number) => `/feeds/${id}/by-id`,
  FEED_BY_SLUG: (slug: string) => `/feeds/${slug}/by-slug`,
  
  // Comments
  FEED_COMMENTS: (feedId: number) => `/feeds/${feedId}/comments`,
  
  // Reactions
  FEED_REACT: (feedId: number) => `/feeds/${feedId}/react`,
  
  // Spaces
  SPACES: '/spaces',
  SPACE_BY_SLUG: (slug: string) => `/spaces/${slug}/by-slug`,
  SPACE_BY_ID: (id: number) => `/spaces/${id}/by-id`,
  
  // Profiles
  PROFILE: (username: string) => `/profile/${username}`,
  MY_PROFILE: '/profile/me',
  
  // Members
  MEMBERS: '/members',
  
  // Activities
  ACTIVITIES: '/activities',
};
