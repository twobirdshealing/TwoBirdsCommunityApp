// =============================================================================
// ROOT LAYOUT - App-wide configuration with Authentication
// =============================================================================
// Uses startup batch API to load all initial data in a single HTTP call.
// UnreadCountsProvider shares badge state between TopHeader and this layout.
// =============================================================================

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ForceUpdateScreen } from '@/components/common/ForceUpdateScreen';
import { MaintenanceScreen } from '@/components/common/MaintenanceScreen';
import { APP_VERSION, FEATURES } from '@/constants/config';
import { isVersionBelow } from '@/utils/version';
import { AppConfigProvider, useAppConfig } from '@/contexts/AppConfigContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AudioPlayerProvider } from '@/contexts/AudioPlayerContext';
import { PusherProvider } from '@/contexts/PusherContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { UnreadCountsProvider, useUnreadCounts } from '@/contexts/UnreadCountsContext';
import { useAppFocus } from '@/hooks/useAppFocus';
import { useStartupData } from '@/hooks/useStartupData';
import { setOnResponseHeaders } from '@/services/api/client';
import { getAppConfig, AppConfigResponse } from '@/services/api/theme';
import { syncBadgeCount } from '@/services/push';
import { mapUrlToRoute } from '@/utils/deepLinkMapper';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';

// Keep the native splash screen visible until we're ready to render
SplashScreen.preventAutoHideAsync();

// -----------------------------------------------------------------------------
// Deep link validation
// -----------------------------------------------------------------------------

const VALID_ROUTE_PREFIXES = [
  '/(tabs)',
  '/feed/',
  '/profile/',
  '/space/',
  '/messages',
  '/notifications',
  '/blog/',
  '/courses',
  '/directory',
  '/bookmarks',
  '/notification-settings',
  '/webview',
  '/bookclub',
  '/youtube',
  '/create-post',
  '/comments/',
  '/blog-comments/',
];

/** Validate that a push notification route matches a known app route */
function isValidRoute(route: string): boolean {
  return VALID_ROUTE_PREFIXES.some((prefix) => route.startsWith(prefix));
}

/** Sanitize a string parameter from notification data (strip non-alphanumeric except - and _) */
function sanitizeParam(value: unknown): string {
  return String(value ?? '').replace(/[^a-zA-Z0-9_\-]/g, '');
}

// -----------------------------------------------------------------------------
// Auth-aware navigation
// -----------------------------------------------------------------------------

function RootLayoutNav() {
  const { isAuthenticated, isLoading, user, logout, updateUser } = useAuth();
  const { isDark, colors: themeColors, update, maintenance, setFromBatch: setThemeFromBatch } = useTheme();
  const { portalSlug, setFromBatch: setAppConfigFromBatch } = useAppConfig();
  const { setUnreadNotifications, setUnreadMessages } = useUnreadCounts();
  const segments = useSegments();
  const router = useRouter();
  const [isRetrying, setIsRetrying] = useState(false);
  const [maintenanceLoginMode, setMaintenanceLoginMode] = useState(false);
  const pendingDeepLink = useRef<{ pathname: string; params?: Record<string, string> } | null>(null);

  // ---------------------------------------------------------------------------
  // Unified config refresh — one fetch, distribute to both contexts
  // ---------------------------------------------------------------------------

  const distributeConfig = useCallback((data: AppConfigResponse) => {
    setThemeFromBatch(data);
    setAppConfigFromBatch(data);
  }, [setThemeFromBatch, setAppConfigFromBatch]);

  const refreshAllConfig = useCallback(async () => {
    const data = await getAppConfig();
    if (!data) return;
    distributeConfig(data);
  }, [distributeConfig]);

  // Refresh config on app resume
  useAppFocus(refreshAllConfig, isAuthenticated);

  // ---------------------------------------------------------------------------
  // Startup Batch — single HTTP call replaces ~11 individual requests
  // ---------------------------------------------------------------------------

  useStartupData({
    isAuthenticated,
    username: user?.username,
    onAppConfig: distributeConfig,
    onProfileUpdate: updateUser,
    onUnreadNotifications: setUnreadNotifications,
    onUnreadMessages: setUnreadMessages,
  });

  // ---------------------------------------------------------------------------
  // Response Header Interceptor — piggyback unread counts + maintenance
  // ---------------------------------------------------------------------------

  useEffect(() => {
    setOnResponseHeaders((data) => {
      if (data.unreadNotifications !== undefined) {
        setUnreadNotifications(data.unreadNotifications);
        syncBadgeCount(data.unreadNotifications);
      }
      if (data.unreadMessages !== undefined) {
        setUnreadMessages(data.unreadMessages);
      }
      if (data.maintenance || (data.minAppVersion && isVersionBelow(APP_VERSION, data.minAppVersion))) {
        // Maintenance or version change detected mid-session — refresh all config
        refreshAllConfig();
      }
    });
    return () => setOnResponseHeaders(null);
  }, [setUnreadNotifications, setUnreadMessages, refreshAllConfig]);

  // ---------------------------------------------------------------------------
  // Deep Link Listener (Universal Links + App Links)
  // ---------------------------------------------------------------------------

  const handleDeepLink = useCallback((url: string) => {
    const route = mapUrlToRoute(url, portalSlug);
    if (!route) return;

    if (isAuthenticated) {
      router.push(route as any);
    } else {
      // Queue for after login
      pendingDeepLink.current = route;
    }
  }, [portalSlug, isAuthenticated, router]);

  useEffect(() => {
    // Handle URL that launched the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Handle URLs while app is open (warm start)
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, [handleDeepLink]);

  // Replay deferred deep link after authentication
  useEffect(() => {
    if (isAuthenticated && pendingDeepLink.current) {
      const route = pendingDeepLink.current;
      pendingDeepLink.current = null;
      setTimeout(() => router.push(route as any), 300);
    }
  }, [isAuthenticated, router]);

  // ---------------------------------------------------------------------------
  // Auth-based navigation
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (isLoading) return;

    // Don't redirect during maintenance — maintenance screen handles login
    if (maintenance?.enabled && !maintenance.can_bypass) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'forgot-password' || segments[0] === 'webview';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && segments[0] === 'login') {
      // Only auto-redirect from login, not register (register needs to finish avatar step)
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, maintenance]);

  // Reset login mode when bypass check completes: can't bypass → back to maintenance
  useEffect(() => {
    if (maintenanceLoginMode && isAuthenticated && maintenance?.can_bypass === false) {
      setMaintenanceLoginMode(false);
    }
  }, [maintenanceLoginMode, isAuthenticated, maintenance]);

  // ---------------------------------------------------------------------------
  // Push Notification Tap Handler
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!FEATURES.PUSH_NOTIFICATIONS) return;

    // Handle notification taps (when user taps on a notification)
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;

      // Route based on notification data
      if (data?.route && typeof data.route === 'string' && isValidRoute(data.route)) {
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          router.push(data.route as any);
        }, 100);
      } else if (data?.feed_id) {
        const id = sanitizeParam(data.feed_id);
        if (id) router.push({ pathname: '/feed/[id]', params: { id } });
      } else if (data?.space_slug) {
        const slug = sanitizeParam(data.space_slug);
        if (slug) router.push({ pathname: '/space/[slug]', params: { slug } });
      } else if (data?.course_slug) {
        const courseSlug = sanitizeParam(data.course_slug);
        if (courseSlug) router.push({ pathname: '/courses/[slug]', params: { slug: courseSlug } });
      } else if (data?.profile_username) {
        const username = sanitizeParam(data.profile_username);
        if (username) router.push({ pathname: '/profile/[username]', params: { username } });
      } else {
        // Default: go to notifications screen
        router.push('/notifications');
      }
    });

    return () => subscription.remove();
  }, [router]);

  // ---------------------------------------------------------------------------
  // Maintenance / Coming Soon Gate
  // ---------------------------------------------------------------------------

  const handleMaintenanceRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await refreshAllConfig();
    } finally {
      setIsRetrying(false);
    }
  }, [refreshAllConfig]);

  const handleMaintenanceLogin = useCallback(() => {
    setMaintenanceLoginMode(true);
  }, []);

  const handleMaintenanceLogout = useCallback(() => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => logout() },
    ]);
  }, [logout]);

  // Hide splash screen once auth state is resolved
  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  if (isLoading) {
    return null;
  }

  // Force update gate — blocks everything when app version is below minimum
  if (update && isVersionBelow(APP_VERSION, update.min_version)) {
    return (
      <View style={[styles.flex, { backgroundColor: themeColors.background }]}>
        <ForceUpdateScreen updateConfig={update} />
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    );
  }

  // Show maintenance screen if enabled and user can't bypass
  if (maintenance?.enabled && !maintenanceLoginMode) {
    // If authenticated but bypass status not yet known, show loading
    if (isAuthenticated && maintenance.can_bypass === undefined) {
      return (
        <View style={[styles.loading, { backgroundColor: themeColors.background }]}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </View>
      );
    }
    // If user can't bypass, show maintenance screen
    if (!maintenance.can_bypass) {
      return (
        <View style={[styles.flex, { backgroundColor: themeColors.background }]}>
          <MaintenanceScreen
            message={maintenance.message}
            onRetry={handleMaintenanceRetry}
            onLogin={handleMaintenanceLogin}
            onLogout={handleMaintenanceLogout}
            isAuthenticated={isAuthenticated}
            isRetrying={isRetrying}
          />
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </View>
      );
    }
  }


  return (
    <View style={[styles.flex, { backgroundColor: themeColors.background }]}>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: themeColors.background },
        }}
      >
        {/* TABS */}
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />

        {/* AUTH */}
        <Stack.Screen
          name="login"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="register"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{ headerShown: false }}
        />

        {/* SPACE ROUTES - nested layout handles screen options */}
        <Stack.Screen
          name="space/[slug]"
          options={{ presentation: 'card', headerShown: false }}
        />

        {/* SINGLE POST VIEW (notifications, deep links) */}
        <Stack.Screen
          name="feed/[id]"
          options={{
            headerShown: true,
            animation: 'default',
            headerStyle: { backgroundColor: themeColors.surface },
            headerTintColor: themeColors.text,
            headerShadowVisible: false,
          }}
        />

        {/* PROFILE */}
        <Stack.Screen
          name="profile/[username]"
          options={{ presentation: 'card', headerShown: false }}
        />

        {/* MESSAGES - folder with _layout.tsx */}
        <Stack.Screen
          name="messages"
          options={{ presentation: 'card', headerShown: false }}
        />

        {/* NOTIFICATIONS */}
        <Stack.Screen
          name="notifications"
          options={{ presentation: 'card', headerShown: false }}
        />

        {/* CHURCH DIRECTORY */}
        <Stack.Screen
          name="directory"
          options={{ presentation: 'card', headerShown: false }}
        />

        {/* BOOKMARKS */}
        <Stack.Screen
          name="bookmarks"
          options={{ presentation: 'card', headerShown: false }}
        />

        {/* BLOG */}
        <Stack.Screen
          name="blog/index"
          options={{ presentation: 'card', headerShown: false }}
        />
        <Stack.Screen
          name="blog/[id]"
          options={{ presentation: 'card', headerShown: false }}
        />

        {/* COURSES */}
        <Stack.Screen
          name="courses/index"
          options={{ presentation: 'card', headerShown: false }}
        />
        <Stack.Screen
          name="courses/[slug]"
          options={{ presentation: 'card', headerShown: false }}
        />
        <Stack.Screen
          name="courses/[slug]/lesson/[lessonSlug]"
          options={{ presentation: 'card', headerShown: false }}
        />

        {/* NOTIFICATION SETTINGS */}
        <Stack.Screen
          name="notification-settings"
          options={{ presentation: 'card', headerShown: false }}
        />

        {/* YOUTUBE */}
        <Stack.Screen
          name="youtube/index"
          options={{ presentation: 'card', headerShown: false }}
        />
        <Stack.Screen
          name="youtube/playlist/[id]"
          options={{ presentation: 'card', headerShown: false }}
        />

        {/* BOOK CLUB */}
        <Stack.Screen
          name="bookclub/index"
          options={{ presentation: 'card', headerShown: false }}
        />
        <Stack.Screen
          name="bookclub/[id]"
          options={{ presentation: 'card', headerShown: false }}
        />

        {/* CREATE POST */}
        <Stack.Screen
          name="create-post"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />

        {/* COMMENTS */}
        <Stack.Screen
          name="comments/[postId]"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />

        {/* BLOG COMMENTS */}
        <Stack.Screen
          name="blog-comments/[postId]"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />

        {/* WEBVIEW - for events, cart, etc */}
        <Stack.Screen
          name="webview"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Root Layout
// -----------------------------------------------------------------------------

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <AppConfigProvider>
              <UnreadCountsProvider>
                <AudioPlayerProvider>
                  <PusherProvider>
                    <KeyboardProvider>
                      <BottomSheetModalProvider>
                        <RootLayoutNav />
                      </BottomSheetModalProvider>
                    </KeyboardProvider>
                  </PusherProvider>
                </AudioPlayerProvider>
              </UnreadCountsProvider>
            </AppConfigProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
