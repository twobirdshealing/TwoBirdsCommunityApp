// =============================================================================
// USE STARTUP DATA - Fires a single batch API call on authenticated startup
// =============================================================================
// Replaces ~12 individual HTTP requests with 1 batch call.
// Distributes results to: AppConfigContext, AuthContext, badge state,
// and widget AsyncStorage caches.
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │ BATCH REQUEST PATHS (core only — modules self-fetch via widgets)   │
// │                                                                    │
// │  1. /tbc-ca/v1/app-config              → config + visibility       │
// │  2. /fluent-community/v2/profile/{user} → profile refresh          │
// │  3. /fluent-community/v2/notifications/unread → notification count │
// │  4. /fluent-community/v2/chat/unread_threads  → message count      │
// │  5. /fluent-community/v2/feeds/welcome-banner → welcome widget     │
// │  6. /fluent-community/v2/courses?type=enrolled&per_page=5 → courses│
// │  7. /wp/v2/posts?page=1&per_page=1&_embed=    → blog widget        │
// │  8. /tbc-ca/v1/youtube/latest?limit=1         → youtube widget     │
// │  9. /tbc-ca/v1/cart/count                     → cart badge count   │
// └─────────────────────────────────────────────────────────────────────┘
// Module widgets (calendar, bookclub, etc.) use useCachedData to
// self-fetch on mount. No batch registration needed.
// =============================================================================

import { useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { batchRequest, findBatchResponse } from '@/services/api/batch';
import { markBatchFresh } from '@/utils/batchCache';
import { syncBadgeCount } from '@/services/push';
import { createLogger } from '@/utils/logger';
import type { AppConfigResponse } from '@/services/api/theme';
import type { AuthUser } from '@/types/user';

const log = createLogger('StartupBatch');

// -----------------------------------------------------------------------------
// Types for batch response data
// -----------------------------------------------------------------------------

interface UnreadNotificationsData {
  notifications: unknown[];
  unread_count: number;
}

interface ProfileData {
  profile: {
    user_id?: number;
    display_name?: string;
    avatar?: string | null;
  };
}

// -----------------------------------------------------------------------------
// Cache keys (must match the widget cacheKey values)
// -----------------------------------------------------------------------------

const WIDGET_CACHE_KEYS = {
  welcomeBanner: 'tbc_welcome_banner',
  courses: 'tbc_widget_enrolled_courses',
  blog: 'tbc_widget_latest_blog',
  youtube: 'tbc_widget_latest_youtube',
};

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

interface UseStartupDataOptions {
  isAuthenticated: boolean;
  username: string | undefined;
  /** Callback to update AppConfigContext with pre-fetched data */
  onAppConfig: (data: AppConfigResponse) => void;
  /** Callback to update AuthContext user data */
  onProfileUpdate: (updates: Partial<AuthUser>) => void;
  /** Callback to set unread notification count */
  onUnreadNotifications: (count: number) => void;
  /** Callback to set unread message count */
  onUnreadMessages: (count: number) => void;
  /** Callback to set cart item count */
  onCartCount: (count: number) => void;
}

export function useStartupData({
  isAuthenticated,
  username,
  onAppConfig,
  onProfileUpdate,
  onUnreadNotifications,
  onUnreadMessages,
  onCartCount,
}: UseStartupDataOptions) {
  const hasRun = useRef(false);

  const runBatch = useCallback(async () => {
    if (!username) return;

    log('Firing startup batch...');

    try {
      const batchPaths = [
        // Core data
        { path: '/tbc-ca/v1/app-config' },
        { path: `/fluent-community/v2/profile/${username}` },
        { path: '/fluent-community/v2/notifications/unread' },
        { path: '/fluent-community/v2/chat/unread_threads' },
        // Core widget data (module widgets self-fetch via useCachedData)
        { path: '/fluent-community/v2/feeds/welcome-banner' },
        { path: '/fluent-community/v2/courses?type=enrolled&per_page=5' },
        { path: '/wp/v2/posts?page=1&per_page=1&_embed=' },
        { path: '/tbc-ca/v1/youtube/latest?limit=1' },
        { path: '/tbc-ca/v1/cart/count' },
      ];

      const responses = await batchRequest(batchPaths);

      log('Batch returned', responses.length, 'responses');

      // -- Distribute core data --

      // 1. App config (visibility + maintenance bypass)
      const appConfig = findBatchResponse<AppConfigResponse>(responses, '/tbc-ca/v1/app-config');
      if (appConfig?.success) {
        onAppConfig(appConfig);
      }

      // 2. Profile refresh
      const profile = findBatchResponse<ProfileData>(responses, '/fluent-community/v2/profile/');
      if (profile?.profile) {
        const p = profile.profile;
        const updates: Partial<AuthUser> = {};
        if (p.user_id) updates.id = p.user_id;
        if (p.avatar !== undefined) updates.avatar = p.avatar || undefined;
        if (p.display_name) updates.displayName = p.display_name;
        if (Object.keys(updates).length > 0) {
          onProfileUpdate(updates);
        }
      }

      // 3. Notification unread count
      const notifData = findBatchResponse<UnreadNotificationsData>(
        responses,
        '/fluent-community/v2/notifications/unread',
      );
      const notifCount = notifData?.unread_count ?? 0;
      onUnreadNotifications(notifCount);
      syncBadgeCount(notifCount);

      // 4. Message unread count (response is { unread_threads: Record<string, number> })
      const chatData = findBatchResponse<{ unread_threads?: Record<string, number> }>(
        responses,
        '/fluent-community/v2/chat/unread_threads',
      );
      const threadKeys = chatData?.unread_threads ? Object.keys(chatData.unread_threads) : [];
      onUnreadMessages(threadKeys.length);

      // 5. Cart item count
      const cartData = findBatchResponse<{ count?: number }>(
        responses,
        '/tbc-ca/v1/cart/count',
      );
      onCartCount(cartData?.count ?? 0);

      // -- Write widget data to AsyncStorage caches --

      const cacheWrites: Promise<void>[] = [];
      const freshKeys: string[] = [];

      // Welcome banner — widget caches the inner welcome_banner object (not full response)
      const bannerData = findBatchResponse<{ welcome_banner?: unknown }>(
        responses,
        '/fluent-community/v2/feeds/welcome-banner',
      );
      if (bannerData?.welcome_banner) {
        freshKeys.push(WIDGET_CACHE_KEYS.welcomeBanner);
        cacheWrites.push(AsyncStorage.setItem(WIDGET_CACHE_KEYS.welcomeBanner, JSON.stringify(bannerData.welcome_banner)));
      }

      // Courses — widget caches courses.data array (paginated response)
      const coursesData = findBatchResponse<{ courses?: { data?: unknown[] } }>(
        responses,
        '/fluent-community/v2/courses',
      );
      if (coursesData) {
        const courses = coursesData.courses?.data ?? [];
        freshKeys.push(WIDGET_CACHE_KEYS.courses);
        cacheWrites.push(AsyncStorage.setItem(WIDGET_CACHE_KEYS.courses, JSON.stringify(courses)));
      }

      // Blog
      const blogData = findBatchResponse<unknown[]>(
        responses,
        '/wp/v2/posts',
      );
      if (Array.isArray(blogData) && blogData.length > 0) {
        freshKeys.push(WIDGET_CACHE_KEYS.blog);
        cacheWrites.push(AsyncStorage.setItem(WIDGET_CACHE_KEYS.blog, JSON.stringify(blogData[0])));
      }

      // YouTube
      const youtubeData = findBatchResponse<{ videos?: unknown[] }>(
        responses,
        '/tbc-ca/v1/youtube/latest',
      );
      if (youtubeData?.videos?.[0]) {
        freshKeys.push(WIDGET_CACHE_KEYS.youtube);
        cacheWrites.push(
          AsyncStorage.setItem(WIDGET_CACHE_KEYS.youtube, JSON.stringify(youtubeData.videos[0])),
        );
      }

      // Write all caches in parallel, then mark them as batch-fresh
      await Promise.all(cacheWrites);
      markBatchFresh(freshKeys);

      log('Startup batch complete —', freshKeys.length, 'widget caches populated');
    } catch (err) {
      // Batch failed — widgets will still self-fetch via useCachedData as normal
      log.error('Failed:', err);
    }
  }, [username, onAppConfig, onProfileUpdate, onUnreadNotifications, onUnreadMessages, onCartCount]);

  // Fire once when authenticated with a username
  useEffect(() => {
    if (isAuthenticated && username && !hasRun.current) {
      hasRun.current = true;
      runBatch();
    }

    if (!isAuthenticated) {
      hasRun.current = false;
    }
  }, [isAuthenticated, username, runBatch]);
}
