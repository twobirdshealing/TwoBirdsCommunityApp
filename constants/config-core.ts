// =============================================================================
// CONFIG CORE - Derived constants and API endpoints
// =============================================================================
// This file is CORE — it gets overwritten on updates. Do not edit.
// For app name, site URL, and other buyer settings, edit config.ts.
// =============================================================================

import Constants from 'expo-constants';
import { SITE_URL } from './config';

// -----------------------------------------------------------------------------
// Derived Constants
// -----------------------------------------------------------------------------

export const APP_VERSION = Constants.expoConfig?.version || '1.0.0';
const rawScheme = Constants.expoConfig?.scheme;
export const APP_SCHEME: string = Array.isArray(rawScheme) ? rawScheme[0] : rawScheme || 'app';

export const API_URL = `${SITE_URL}/wp-json/fluent-community/v2`;
export const DEFAULT_PER_PAGE = 20;

// Pusher channel auth endpoint (Fluent Messaging's built-in endpoint).
// Socket provider config (app key, cluster, host) is served dynamically
// from the server via /app-config — no app-side keys needed.
export const PUSHER_CONFIG = {
  AUTH_ENDPOINT: `${API_URL}/chat/broadcast/auth`,
};

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
  COURSE_JOIN: (courseId: number) => `/courses/${courseId}/join`,
  COURSE_QUIZ_SUBMIT: (courseId: number, lessonId: number) =>
    `/courses/${courseId}/lessons/${lessonId}/quiz/submit`,
  COURSE_QUIZ_RESULT: (courseId: number, lessonId: number) =>
    `/courses/${courseId}/lessons/${lessonId}/quiz/result`,

  // Moderation
  MODERATION_REPORT: '/moderation/report',
};

// -----------------------------------------------------------------------------
// Plugin API URLs (derived from SITE_URL)
// -----------------------------------------------------------------------------

export const TBC_CA_URL = `${SITE_URL}/wp-json/tbc-ca/v1`;
export const WP_REST_URL = `${SITE_URL}/wp-json/wp/v2`;

export const WP_ENDPOINTS = {
  POSTS: '/posts',
  POST_BY_ID: (id: number) => `/posts/${id}`,
  COMMENTS: '/comments',
};
