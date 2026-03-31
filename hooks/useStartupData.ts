// =============================================================================
// USE STARTUP DATA - Fires a single batch API call on authenticated startup
// =============================================================================
// Replaces ~12 individual HTTP requests with 1 batch call.
// Distributes results to: AppConfigContext, AuthContext, badge state,
// and TanStack Query widget caches.
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
// │  (cart count now handled by cart module via response headers)       │
// └─────────────────────────────────────────────────────────────────────┘
// Module widgets (calendar, bookclub, etc.) use useAppQuery to
// self-fetch on mount. No batch registration needed.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { batchRequest, findBatchResponse } from '@/services/api/batch';
import { getJSON } from '@/services/storage';
import { FEATURES_CACHE_KEY } from '@/utils/featureFlags';
import { createLogger } from '@/utils/logger';
import type { AppConfigResponse } from '@/services/api/appConfig';
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
};

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export type StartupStatus = 'idle' | 'loading' | 'success' | 'error';

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
}

interface UseStartupDataResult {
  status: StartupStatus;
  retry: () => Promise<void>;
}

export function useStartupData({
  isAuthenticated,
  username,
  onAppConfig,
  onProfileUpdate,
  onUnreadNotifications,
  onUnreadMessages,
}: UseStartupDataOptions): UseStartupDataResult {
  const hasRun = useRef(false);
  const [status, setStatus] = useState<StartupStatus>('idle');
  const queryClient = useQueryClient();

  const runBatch = useCallback(async () => {
    if (!username) return;
    setStatus('loading');

    log('Firing startup batch...');

    try {
      const batchPaths = [
        // Core data
        { path: '/tbc-ca/v1/app-config' },
        { path: `/fluent-community/v2/profile/${username}` },
        { path: '/fluent-community/v2/notifications/unread' },
        { path: '/fluent-community/v2/chat/unread_threads' },
        // Core widget data (module widgets self-fetch via useAppQuery)
        { path: '/fluent-community/v2/feeds/welcome-banner' },
        { path: '/fluent-community/v2/courses?type=enrolled&per_page=5' },
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

      // 4. Message unread count (response is { unread_threads: Record<string, number> })
      const chatData = findBatchResponse<{ unread_threads?: Record<string, number> }>(
        responses,
        '/fluent-community/v2/chat/unread_threads',
      );
      const threadKeys = chatData?.unread_threads ? Object.keys(chatData.unread_threads) : [];
      onUnreadMessages(threadKeys.length);

      // -- Pre-populate TanStack Query cache with widget data --
      // This means when widgets mount with useAppQuery, data is already there.

      // Welcome banner — widget caches the inner welcome_banner object
      const bannerData = findBatchResponse<{ welcome_banner?: unknown }>(
        responses,
        '/fluent-community/v2/feeds/welcome-banner',
      );
      if (bannerData?.welcome_banner) {
        queryClient.setQueryData([WIDGET_CACHE_KEYS.welcomeBanner], bannerData.welcome_banner);
      }

      // Courses — widget caches courses.data array (paginated response)
      const coursesData = findBatchResponse<{ courses?: { data?: unknown[] } }>(
        responses,
        '/fluent-community/v2/courses',
      );
      if (coursesData) {
        queryClient.setQueryData([WIDGET_CACHE_KEYS.courses], coursesData.courses?.data ?? []);
      }

      setStatus('success');
      log('Startup batch complete');
    } catch (err) {
      log.error('Failed:', err);
      // Batch failed — check if we have cached features from a previous session (synchronous)
      const cached = getJSON(FEATURES_CACHE_KEY);
      setStatus(cached ? 'success' : 'error');
    }
  }, [username, onAppConfig, onProfileUpdate, onUnreadNotifications, onUnreadMessages, queryClient]);

  // Fire once when authenticated with a username
  useEffect(() => {
    if (isAuthenticated && username && !hasRun.current) {
      hasRun.current = true;
      runBatch();
    }

    if (!isAuthenticated) {
      hasRun.current = false;
      setStatus('idle');
    }
  }, [isAuthenticated, username, runBatch]);

  return { status, retry: runBatch };
}
