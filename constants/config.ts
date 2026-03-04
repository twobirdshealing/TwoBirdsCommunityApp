// =============================================================================
// CONFIG - App configuration and API settings
// =============================================================================

import Constants from 'expo-constants';

// -----------------------------------------------------------------------------
// App Info
// -----------------------------------------------------------------------------

export const APP_NAME = 'Two Birds';
export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';

// -----------------------------------------------------------------------------
// API Configuration
// -----------------------------------------------------------------------------

// Read SITE_URL from app.config.ts → extra.siteUrl (set per EAS build profile).
// Falls back to staging if not set (e.g. local dev with `npx expo start`).
export const SITE_URL: string =
  Constants.expoConfig?.extra?.siteUrl || 'https://staging.twobirdschurch.com';
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

  // Profile - Use username, NOT "me"
  // Sub-paths (/follow, /spaces, etc.) are built inline by services/api/profiles.ts
  PROFILE: (username: string) => `/profile/${username}`,

  // Notifications
  NOTIFICATIONS: '/notifications',
  NOTIFICATIONS_UNREAD: '/notifications/unread',
  NOTIFICATIONS_MARK_READ: (id: number) => `/notifications/mark-read/${id}`,
  NOTIFICATIONS_MARK_ALL_READ: '/notifications/mark-all-read',

  // Members
  MEMBERS: '/members',

  // Chat/Messaging
  CHAT_THREADS: '/chat/threads',
  CHAT_MESSAGES: (threadId: number) => `/chat/messages/${threadId}`,
  CHAT_MESSAGES_NEW: (threadId: number, lastId: number) => `/chat/messages/${threadId}/new?last_id=${lastId}`,
  CHAT_UNREAD_THREADS: '/chat/unread_threads',
  CHAT_MARK_READ: '/chat/read-threads',
  CHAT_USERS: '/chat/users',
  CHAT_MESSAGE_DELETE: (messageId: number) => `/chat/messages/delete/${messageId}`,
  CHAT_THREAD_BLOCK: (threadId: number) => `/chat/threads/block/${threadId}`,
  CHAT_THREAD_UNBLOCK: (threadId: number) => `/chat/threads/unblock/${threadId}`,

  // v2.2.0 new endpoints
  CHAT_MESSAGE_REACT: (messageId: number) => `/chat/messages/${messageId}/react`,
  CHAT_THREAD_DELETE: (threadId: number) => `/chat/threads/delete/${threadId}`,
  CHAT_THREAD_BY_ID: (threadId: number) => `/chat/threads/${threadId}`,

  // Courses (Fluent LMS)
  COURSES: '/courses',
  COURSE_BY_SLUG: (slug: string) => `/courses/${slug}/by-slug`,
  COURSE_ENROLL: (courseId: number) => `/courses/${courseId}/enroll`,
  COURSE_LESSON_BY_SLUG: (courseSlug: string, lessonSlug: string) =>
    `/courses/${courseSlug}/lessons/${lessonSlug}/by-slug`,
  COURSE_LESSON_COMPLETION: (courseId: number, lessonId: number) =>
    `/courses/${courseId}/lessons/${lessonId}/completion`,
};

// -----------------------------------------------------------------------------
// Pusher Configuration (Real-time messaging)
// -----------------------------------------------------------------------------

export const PUSHER_CONFIG = {
  APP_KEY: '2ee0dcc0255ee7f9a996',
  CLUSTER: 'us3',
  AUTH_ENDPOINT: `${API_URL}/chat/broadcast/auth`,
};

// -----------------------------------------------------------------------------
// Feature Flags
// -----------------------------------------------------------------------------

export const FEATURES = {
  DARK_MODE: true,         // Synced with Fluent Community theme
  PUSH_NOTIFICATIONS: true, // TBC-CA plugin push notifications
  MESSAGING: true,         // Fluent Messaging enabled
  COURSES: true,           // Fluent LMS courses
  BOOK_CLUB: true,         // TBC Book Club audiobook player
};

// -----------------------------------------------------------------------------
// TBC Community App Plugin (Push Notifications)
// -----------------------------------------------------------------------------

export const TBC_CA_URL = `${SITE_URL}/wp-json/tbc-ca/v1`;

// -----------------------------------------------------------------------------
// TBC Multi Reactions Plugin
// -----------------------------------------------------------------------------

export const TBC_MR_URL = `${SITE_URL}/wp-json/tbc-multi-reactions/v1`;

// -----------------------------------------------------------------------------
// WordPress REST API (Blog Posts)
// -----------------------------------------------------------------------------

export const WP_REST_URL = `${SITE_URL}/wp-json/wp/v2`;

export const WP_ENDPOINTS = {
  POSTS: '/posts',
  POST_BY_ID: (id: number) => `/posts/${id}`,
  COMMENTS: '/comments',
};

// -----------------------------------------------------------------------------
// Legal / Policy URLs
// -----------------------------------------------------------------------------

export const PRIVACY_POLICY_URL = `${SITE_URL}/privacy-policy/`;

// -----------------------------------------------------------------------------
// YouTube Channel
// -----------------------------------------------------------------------------

export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/c/twobirdschurch?sub_confirmation=1';