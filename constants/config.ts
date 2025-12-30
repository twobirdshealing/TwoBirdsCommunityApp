// =============================================================================
// CONFIG - App configuration and API settings
// =============================================================================

// -----------------------------------------------------------------------------
// App Info
// -----------------------------------------------------------------------------

export const APP_NAME = 'Two Birds';
export const APP_VERSION = '1.0.0';

// -----------------------------------------------------------------------------
// API Configuration
// -----------------------------------------------------------------------------

// IMPORTANT: Use HTTPS to prevent auth header stripping on redirects
export const SITE_URL = 'https://staging.twobirdschurch.com';
export const API_URL = `${SITE_URL}/wp-json/fluent-community/v2`;

// Default pagination
export const DEFAULT_PER_PAGE = 20;

// -----------------------------------------------------------------------------
// API Endpoints
// -----------------------------------------------------------------------------

export const ENDPOINTS = {
  // Feeds
  FEEDS: '/feeds',
  FEED_BY_ID: (id: number) => `/feeds/${id}/by-id`,
  FEED_BY_SLUG: (slug: string) => `/feeds/${slug}/by-slug`,
  FEED_COMMENTS: (id: number) => `/feeds/${id}/comments`,
  FEED_REACT: (id: number) => `/feeds/${id}/react`,
  FEED_REACTIONS: (id: number) => `/feeds/${id}/reactions`,
  WELCOME_BANNER: '/feeds/welcome-banner',
  
  // Spaces
  SPACES: '/spaces',
  SPACE_BY_ID: (id: number) => `/spaces/${id}/by-id`,
  SPACE_BY_SLUG: (slug: string) => `/spaces/${slug}/by-slug`,
  SPACE_JOIN: (slug: string) => `/spaces/${slug}/join`,
  SPACE_LEAVE: (slug: string) => `/spaces/${slug}/leave`,
  SPACE_MEMBERS: (slug: string) => `/spaces/${slug}/members`,
  
  // Profile - Use username, NOT "me"
  PROFILE: (username: string) => `/profile/${username}`,
  PROFILE_SPACES: (username: string) => `/profile/${username}/spaces`,
  PROFILE_COMMENTS: (username: string) => `/profile/${username}/comments`,
  PROFILE_FOLLOW: (username: string) => `/profile/${username}/follow`,
  PROFILE_UNFOLLOW: (username: string) => `/profile/${username}/unfollow`,
  PROFILE_FOLLOWERS: (username: string) => `/profile/${username}/followers`,
  PROFILE_FOLLOWING: (username: string) => `/profile/${username}/followings`,
  
  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATIONS_UNREAD: '/notifications/unread',
  NOTIFICATIONS_MARK_READ: (id: number) => `/notifications/mark-read/${id}`,
  NOTIFICATIONS_MARK_ALL_READ: '/notifications/mark-all-read',
  
  // Members
  MEMBERS: '/members',
  
  // Activities
  ACTIVITIES: '/activities',
};

// -----------------------------------------------------------------------------
// Feature Flags
// -----------------------------------------------------------------------------

export const FEATURES = {
  DARK_MODE: false,        // Coming soon
  PUSH_NOTIFICATIONS: false, // Coming soon
  MESSAGING: false,        // Requires Fluent Messaging plugin
  COURSES: false,          // Requires Fluent LMS
};

// -----------------------------------------------------------------------------
// Debug/Testing Configuration
// -----------------------------------------------------------------------------

/**
 * DEVELOPMENT/TESTING ONLY
 * Bypass SecureStore authentication and use hardcoded credentials
 * This helps isolate authentication issues by eliminating the login flow
 */
export const DEBUG_AUTH = {
  // Set to true to bypass login and use hardcoded credentials below
  USE_HARDCODED_AUTH: true,

  // Hardcoded credentials (only used when USE_HARDCODED_AUTH is true)
  // IMPORTANT: NEVER commit this as true in production!
  HARDCODED_USERNAME: 'bluejay',
  HARDCODED_PASSWORD: 'u5oa 98Qu KrHb dGlt XE5K xwmk',
};