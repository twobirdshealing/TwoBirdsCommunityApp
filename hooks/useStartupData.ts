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
// │  Always included:                                                  │
// │  1. /tbc-ca/v1/app-config              → config + visibility       │
// │  2. /fluent-community/v2/profile/{user} → profile refresh          │
// │  3. /fluent-community/v2/notifications/unread → notification count │
// │  4. /fluent-community/v2/feeds/welcome-banner → welcome widget     │
// │                                                                    │
// │  Conditional (based on cached feature flags):                      │
// │  5. /fluent-community/v2/chat/unread_threads  → if messaging on    │
// │  6. /fluent-community/v2/courses?...          → if courses on      │
// │  (cart count handled by cart module via response headers)           │
// └─────────────────────────────────────────────────────────────────────┘
// Module widgets (calendar, bookclub, etc.) use useAppQuery to
// self-fetch on mount. No batch registration needed.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { batchRequest, findBatchResponse } from '@/services/api/batch';
import { getJSON } from '@/services/storage';
import { FEATURES_CACHE_KEY, getFeatureFlag } from '@/utils/featureFlags';
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

// Hard cap on retry attempts before we stop hammering the server.
// Beyond this, the startup error screen should suggest contacting support.
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = [1000, 2000, 4000];

export function useStartupData({
  isAuthenticated,
  username,
  onAppConfig,
  onProfileUpdate,
  onUnreadNotifications,
  onUnreadMessages,
}: UseStartupDataOptions): UseStartupDataResult {
  const hasRun = useRef(false);
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const [status, setStatus] = useState<StartupStatus>('idle');
  const queryClient = useQueryClient();

  // Track mount lifetime so a slow batch can't update state after unmount or logout.
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const runBatch = useCallback(async () => {
    if (!username) return;

    // Capture the username at start so a logout-then-login race can't apply
    // a stale response to the wrong user.
    const startUsername = username;
    setStatus('loading');

    log.debug('Firing startup batch...');

    const fallbackToCache = () => {
      const cached = getJSON(FEATURES_CACHE_KEY);
      setStatus(cached ? 'success' : 'error');
    };

    try {
      // Build batch paths — conditional paths use cached features from previous session.
      // On first launch defaults are all OFF (conservative), so no wasted 404s.
      const batchPaths = [
        // Core data (always included)
        { path: '/tbc-ca/v1/app-config' },
        { path: `/fluent-community/v2/profile/${startUsername}` },
        { path: '/fluent-community/v2/notifications/unread' },
        { path: '/fluent-community/v2/feeds/welcome-banner' },
        // Conditional — only include if feature was enabled last session
        ...(getFeatureFlag('messaging') ? [{ path: '/fluent-community/v2/chat/unread_threads' }] : []),
        ...(getFeatureFlag('courses') ? [{ path: '/fluent-community/v2/courses?type=enrolled&per_page=5' }] : []),
      ];

      const result = await batchRequest(batchPaths);

      // Bail if the user logged out or the hook unmounted while we were waiting.
      if (!isMountedRef.current || !hasRun.current) {
        log.debug('Batch returned after unmount/logout — discarding');
        return;
      }

      // Expected failures (expired auth, network timeout, server down) — not
      // a bug, don't spam Sentry.
      if (!result.success) {
        log.warn('Batch request failed', { error: result.error.message });
        fallbackToCache();
        return;
      }

      const responses = result.data;
      log.debug('Batch returned', { count: responses.length });

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

      // 4. Message unread count (response: { unread_threads: Record<id, count> })
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

      // Treat the batch as a success only if the two critical sub-responses
      // (app config + profile) actually arrived. Without them the user lands
      // on the home screen with no profile or feature flags — worse than a
      // retry screen.
      if (appConfig?.success && profile?.profile) {
        retryCountRef.current = 0;
        setStatus('success');
        log.debug('Startup batch complete');
      } else {
        log.warn('Batch transport OK but critical sub-responses missing', {
          hasAppConfig: !!appConfig?.success,
          hasProfile: !!profile?.profile,
        });
        setStatus('error');
      }
    } catch (err) {
      if (!isMountedRef.current || !hasRun.current) return;
      // Unexpected error distributing batch results (real bug — worth Sentry).
      // Network/auth failures are handled above via the ApiResponse path.
      log.error(err, 'Startup batch distribution failed');
      fallbackToCache();
    }
  }, [username, onAppConfig, onProfileUpdate, onUnreadNotifications, onUnreadMessages, queryClient]);

  // Wrapper exposed as `retry` — enforces a max attempt count and exponential
  // backoff so a user repeatedly tapping "retry" can't hammer the server.
  const retry = useCallback(async () => {
    if (retryCountRef.current >= MAX_RETRIES) {
      log.warn('Max startup retries reached — refusing further attempts');
      return;
    }
    const delay = RETRY_BACKOFF_MS[retryCountRef.current] ?? 4000;
    retryCountRef.current += 1;
    setStatus('loading');
    await new Promise(resolve => setTimeout(resolve, delay));
    if (!isMountedRef.current) return;
    await runBatch();
  }, [runBatch]);

  // Fire once when authenticated with a username
  useEffect(() => {
    if (isAuthenticated && username && !hasRun.current) {
      hasRun.current = true;
      retryCountRef.current = 0;
      runBatch();
    }

    if (!isAuthenticated) {
      hasRun.current = false;
      retryCountRef.current = 0;
      setStatus('idle');
    }
  }, [isAuthenticated, username, runBatch]);

  return { status, retry };
}
