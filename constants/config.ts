// =============================================================================
// CONFIG - App configuration and API settings
// =============================================================================
// SETUP: Values marked with "// SETUP" are buyer-editable.
// Everything else is derived automatically — don't change it.
// For modules (calendar, blog, etc.), edit modules/_registry.ts
// =============================================================================

import Constants from 'expo-constants';

// -----------------------------------------------------------------------------
// SETUP: App Info
// -----------------------------------------------------------------------------

export const APP_NAME = 'Two Birds';                   // SETUP: Your app name
export const APP_USER_AGENT = 'TBCCommunityApp/1.0';   // SETUP: User agent for API requests
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

// -----------------------------------------------------------------------------
// SETUP: Site URL
// -----------------------------------------------------------------------------

// EAS build profiles override this via SITE_URL env var (see eas.json).
// This fallback is used for local dev with `npx expo start`.
export const SITE_URL: string =
  Constants.expoConfig?.extra?.siteUrl || 'https://community.twobirdschurch.com'; // SETUP: Your WordPress site URL

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
  POST_COMMENTS: (id: number) => `/feeds/${id}/comments`,
  FEED_REACT: (id: number) => `/feeds/${id}/react`,
  FEED_REACTIONS: (id: number) => `/feeds/${id}/reactions`,
  SURVEY_VOTE: (id: number) => `/feeds/${id}/apps/survey-vote`,
  SURVEY_VOTERS: (id: number, slug: string) => `/feeds/${id}/apps/survey-voters/${slug}`,
  WELCOME_BANNER: '/feeds/welcome-banner',

  // Spaces
  SPACES: '/spaces',
  SPACE_BY_ID: (id: number) => `/spaces/${id}/by-id`,
  SPACE_BY_SLUG: (slug: string) => `/spaces/${slug}/by-slug`,

  // Profile (sub-paths built in services/api/profiles.ts)
  PROFILE: (username: string) => `/profile/${username}`,

  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATIONS_UNREAD: '/notifications/unread',
  NOTIFICATIONS_MARK_READ: (id: number) => `/notifications/mark-read/${id}`,
  NOTIFICATIONS_MARK_ALL_READ: '/notifications/mark-all-read',

  // Members
  MEMBERS: '/members',

  // Chat/Messaging (requires Fluent Messaging add-on)
  CHAT_THREADS: '/chat/threads',
  CHAT_THREAD_BY_ID: (threadId: number) => `/chat/threads/${threadId}`,
  CHAT_MESSAGES: (threadId: number) => `/chat/messages/${threadId}`,
  CHAT_MESSAGES_NEW: (threadId: number, lastId: number) => `/chat/messages/${threadId}/new?last_id=${lastId}`,
  CHAT_UNREAD_THREADS: '/chat/unread_threads',
  CHAT_MARK_READ: '/chat/read-threads',
  CHAT_USERS: '/chat/users',
  CHAT_MESSAGE_DELETE: (messageId: number) => `/chat/messages/delete/${messageId}`,
  CHAT_MESSAGE_REACT: (messageId: number) => `/chat/messages/${messageId}/react`,
  CHAT_THREAD_DELETE: (threadId: number) => `/chat/threads/delete/${threadId}`,
  CHAT_THREAD_BLOCK: (threadId: number) => `/chat/threads/block/${threadId}`,
  CHAT_THREAD_UNBLOCK: (threadId: number) => `/chat/threads/unblock/${threadId}`,

  // Courses (requires Fluent LMS add-on)
  COURSES: '/courses',
  COURSE_BY_SLUG: (slug: string) => `/courses/${slug}/by-slug`,
  COURSE_ENROLL: (courseId: number) => `/courses/${courseId}/enroll`,
  COURSE_LESSON_BY_SLUG: (courseSlug: string, lessonSlug: string) =>
    `/courses/${courseSlug}/lessons/${lessonSlug}/by-slug`,
  COURSE_LESSON_COMPLETION: (courseId: number, lessonId: number) =>
    `/courses/${courseId}/lessons/${lessonId}/completion`,
};

// -----------------------------------------------------------------------------
// SETUP: Pusher Configuration (Real-time messaging)
// -----------------------------------------------------------------------------

export const PUSHER_CONFIG = {
  APP_KEY: '2ee0dcc0255ee7f9a996',                     // SETUP: Your Pusher app key
  CLUSTER: 'us3',                                       // SETUP: Your Pusher cluster
  AUTH_ENDPOINT: `${API_URL}/chat/broadcast/auth`,
};

// -----------------------------------------------------------------------------
// SETUP: Feature Flags
// -----------------------------------------------------------------------------

export const FEATURES = {
  DARK_MODE: true,          // SETUP: Dark mode synced from Fluent Community theme
  PUSH_NOTIFICATIONS: true, // SETUP: Push notifications via TBC-CA plugin
  MESSAGING: true,          // SETUP: Fluent Messaging (direct chat)
  COURSES: true,            // SETUP: Fluent LMS courses
  CART: true,               // SETUP: WooCommerce cart icon in header (disable if no WooCommerce)
  YOUTUBE: true,            // SETUP: YouTube integration (channel videos & playlists via TBC-CA plugin)
  PROFILE_TABS: {           // SETUP: Which tabs appear on user profiles (About is always on)
    POSTS: true,            // User's posts feed
    SPACES: true,           // User's joined spaces
    COMMENTS: true,         // User's comments
  },
};

// -----------------------------------------------------------------------------
// Plugin API URLs (derived from SITE_URL)
// -----------------------------------------------------------------------------

export const TBC_CA_URL = `${SITE_URL}/wp-json/tbc-ca/v1`;
export const TBC_FP_URL = `${SITE_URL}/wp-json/tbc-fp/v1`;
export const TBC_MR_URL = `${SITE_URL}/wp-json/tbc-multi-reactions/v1`;
export const WP_REST_URL = `${SITE_URL}/wp-json/wp/v2`;

export const WP_ENDPOINTS = {
  POSTS: '/posts',
  POST_BY_ID: (id: number) => `/posts/${id}`,
  COMMENTS: '/comments',
};

// -----------------------------------------------------------------------------
// SETUP: Links
// -----------------------------------------------------------------------------

export const PRIVACY_POLICY_URL = `${SITE_URL}/privacy-policy/`;                           // SETUP: Privacy policy URL
export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/c/twobirdschurch?sub_confirmation=1'; // SETUP: YouTube channel "Subscribe" button URL (youtube/index.tsx header)
