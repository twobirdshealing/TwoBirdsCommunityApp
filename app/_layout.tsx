// =============================================================================
// ROOT LAYOUT - App-wide configuration with Authentication
// =============================================================================
// SIMPLIFIED: No CartProvider
// UPDATED: Added push notification tap handler
// =============================================================================

import { FEATURES } from '@/constants/config';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { PusherProvider } from '@/contexts/PusherContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { syncBadgeCount } from '@/services/push';
import { notificationsApi } from '@/services/api';
import 'react-native-reanimated';

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
      if (data?.route && typeof data.route === 'string') {
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          router.push(data.route as any);
        }, 100);
      } else if (data?.feed_id) {
        // Legacy: navigate to feed detail
        router.push({
          pathname: '/feed/[id]',
          params: { id: String(data.feed_id) },
        });
      } else if (data?.space_slug) {
        // Legacy: navigate to space
        router.push({
          pathname: '/space/[slug]',
          params: { slug: String(data.space_slug) },
        });
      } else if (data?.profile_username) {
        // Legacy: navigate to profile
        router.push({
          pathname: '/profile/[username]',
          params: { username: String(data.profile_username) },
        });
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
      const count = await notificationsApi.getUnreadCount();
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
    <>
      <Stack>
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

        {/* SPACE ROUTES */}
        <Stack.Screen
          name="space/[slug]/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="space/[slug]/members"
          options={{ headerShown: true, title: 'Members' }}
        />

        {/* SINGLE POST VIEW (notifications, deep links) */}
        <Stack.Screen
          name="feed/[id]"
          options={{
            headerShown: true,
            animation: 'default',
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
    </>
  );
}

// -----------------------------------------------------------------------------
// Root Layout
// -----------------------------------------------------------------------------

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PusherProvider>
          <RootLayoutNav />
        </PusherProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});