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
import { PusherProvider } from '@/contexts/PusherContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { UnreadCountsProvider, useUnreadCounts } from '@/contexts/UnreadCountsContext';
import { useAppFocus } from '@/hooks/useAppFocus';
import { useStartupData } from '@/hooks/useStartupData';
import { setOnResponseHeaders } from '@/services/api/client';
import { getAppConfig, AppConfigResponse } from '@/services/api/theme';
import { syncBadgeCount } from '@/services/push';
import { mapUrlToRoute } from '@/utils/deepLinkMapper';
import { ThemeProvider as NavThemeProvider, DefaultTheme, type Theme as NavTheme } from '@react-navigation/native';
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
import { getModuleProviders, getModuleRoutePrefixes } from '@/modules/_registry';
import 'react-native-reanimated';

// Keep the native splash screen visible until we're ready to render
SplashScreen.preventAutoHideAsync();

// Transparent nav theme — lets the root View background show through card containers,
// preventing white flash on first stack navigation.
const TRANSPARENT_NAV_THEME: NavTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent', card: 'transparent' },
};

// -----------------------------------------------------------------------------
// Deep link / push notification route validation
// -----------------------------------------------------------------------------

/** Core route prefixes — always present regardless of modules */
const CORE_ROUTE_PREFIXES = [
  '/(tabs)',
  '/feed/',
  '/profile/',
  '/space/',
  '/messages',
  '/notifications',
  '/courses',
  '/directory',
  '/bookmarks',
  '/notification-settings',
  '/webview',
  '/create-post',
  '/comments/',
  // TODO: move to blog module once modularized
  '/blog/',
  '/blog-comments/',
];

/** Core + module-registered prefixes (resolved once at load time).
 *  Safe because MODULES is a static import-time array — not lazily registered. */
const VALID_ROUTE_PREFIXES = [
  ...CORE_ROUTE_PREFIXES,
  ...getModuleRoutePrefixes(),
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
  const { isAuthenticated, isLoading, user, logout, updateUser, needsProfileCompletion, markProfileComplete, markProfileIncomplete } = useAuth();
  const { isDark, colors: themeColors, update, maintenance, setFromBatch: setThemeFromBatch } = useTheme();
  const { portalSlug, setFromBatch: setAppConfigFromBatch } = useAppConfig();
  const { setUnreadNotifications, setUnreadMessages, setCartCount } = useUnreadCounts();
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
    onCartCount: setCartCount,
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
      if (data.cartCount !== undefined) {
        setCartCount(data.cartCount);
      }
      if (data.profileIncomplete !== undefined) {
        // Idempotent — safe to call on every response without a guard
        data.profileIncomplete ? markProfileIncomplete() : markProfileComplete();
      }
      if (data.maintenance || (data.minAppVersion && isVersionBelow(APP_VERSION, data.minAppVersion))) {
        // Maintenance or version change detected mid-session — refresh all config
        refreshAllConfig();
      }
    });
    return () => setOnResponseHeaders(null);
  }, [setUnreadNotifications, setUnreadMessages, setCartCount, refreshAllConfig, markProfileIncomplete, markProfileComplete]);

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

    // Don't redirect during maintenance — unless user initiated login from maintenance screen
    if (maintenance?.enabled && !maintenance.can_bypass && !maintenanceLoginMode) return;

    const currentSegment = segments[0] as string;
    const inAuthGroup = currentSegment === 'login' || currentSegment === 'register' || currentSegment === 'forgot-password' || currentSegment === 'webview' || currentSegment === 'profile-complete';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && needsProfileCompletion && currentSegment !== 'profile-complete' && currentSegment !== 'register') {
      // Redirect to profile completion if profile is incomplete
      router.replace('/profile-complete' as any);
    } else if (isAuthenticated && !needsProfileCompletion && segments[0] === 'login') {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, maintenance, needsProfileCompletion, maintenanceLoginMode]);

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

  // Maintenance gate
  if (maintenance?.enabled) {
    // Authenticated but bypass status not yet known — show loading
    if (isAuthenticated && maintenance.can_bypass === undefined) {
      return (
        <View style={[styles.loading, { backgroundColor: themeColors.background }]}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <StatusBar style={isDark ? 'light' : 'dark'} />
        </View>
      );
    }
    // User can't bypass and hasn't initiated login — show maintenance screen
    if (!maintenance.can_bypass && !maintenanceLoginMode) {
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
    <NavThemeProvider value={TRANSPARENT_NAV_THEME}>
      <View style={[styles.flex, { backgroundColor: themeColors.background }]}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: themeColors.background },
          }}
        >

        {/* TABS */}
        <Stack.Screen name="(tabs)" />

        {/* SINGLE POST VIEW — only screen with a visible header */}
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

        {/* FULL SCREEN MODALS — slide up from bottom */}
        <Stack.Screen name="create-post" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="comments/[postId]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="blog-comments/[postId]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="webview" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />

        {/* All other routes auto-discover from file stubs with defaults:
            presentation: 'card', headerShown: false
            Module routes (e.g. bookclub/index, bookclub/[id]) just need
            a file stub in app/ — no entry here required. */}

        </Stack>
        <StatusBar style={isDark ? 'light' : 'dark'} />
      </View>
    </NavThemeProvider>
  );
}

// -----------------------------------------------------------------------------
// Module Providers — wraps providers registered by modules
// -----------------------------------------------------------------------------

function ModuleProviders({ children }: { children: React.ReactNode }) {
  const providers = getModuleProviders();
  if (providers.length === 0) return <>{children}</>;

  // Nest providers from outside-in based on order
  return providers.reduceRight<React.ReactNode>(
    (acc, { component: Provider }) => <Provider>{acc}</Provider>,
    children,
  ) as React.ReactElement;
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
                <PusherProvider>
                  <ModuleProviders>
                    <KeyboardProvider>
                      <BottomSheetModalProvider>
                        <RootLayoutNav />
                      </BottomSheetModalProvider>
                    </KeyboardProvider>
                  </ModuleProviders>
                </PusherProvider>
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
