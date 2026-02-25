// =============================================================================
// ROOT LAYOUT - App-wide configuration with Authentication
// =============================================================================
// SIMPLIFIED: No CartProvider
// UPDATED: Added push notification tap handler
// =============================================================================

import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { FEATURES } from '@/constants/config';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PusherProvider } from '@/contexts/PusherContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { syncBadgeCount } from '@/services/push';
import { notificationsApi } from '@/services/api';
import 'react-native-reanimated';

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
  const { isAuthenticated, isLoading } = useAuth();
  const { isDark, colors: themeColors } = useTheme();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'forgot-password';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && segments[0] === 'login') {
      // Only auto-redirect from login, not register (register needs to finish avatar step)
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

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
  // Badge Sync - correct app icon badge on foreground
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchAndSyncBadge = async () => {
      const count = await notificationsApi.getNotificationUnreadCount();
      syncBadgeCount(count);
    };

    // Sync on mount (app just opened)
    fetchAndSyncBadge();

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        fetchAndSyncBadge();
      }
    });

    return () => subscription.remove();
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.primary} />
      </View>
    );
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
            <PusherProvider>
              <BottomSheetModalProvider>
                <RootLayoutNav />
              </BottomSheetModalProvider>
            </PusherProvider>
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