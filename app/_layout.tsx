// =============================================================================
// ROOT LAYOUT - App-wide configuration with Authentication
// =============================================================================
// SIMPLIFIED: No CartProvider
// =============================================================================

import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/colors';

// -----------------------------------------------------------------------------
// Auth-aware navigation
// -----------------------------------------------------------------------------

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
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

        {/* SPACE ROUTES */}
        <Stack.Screen
          name="space/[slug]/index"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="space/[slug]/members"
          options={{ headerShown: true, title: 'Members' }}
        />

        {/* FEED DETAIL */}
        <Stack.Screen
          name="feed/[id]"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />

        {/* PROFILE */}
        <Stack.Screen
          name="profile/[username]"
          options={{ presentation: 'card', headerShown: true }}
        />

        {/* MESSAGES */}
        <Stack.Screen
          name="messages"
          options={{ presentation: 'card', headerShown: true, title: 'Messages' }}
        />

        {/* NOTIFICATIONS */}
        <Stack.Screen
          name="notifications"
          options={{ presentation: 'card', headerShown: true, title: 'Notifications' }}
        />

        {/* BOOKMARKS */}
        <Stack.Screen
          name="bookmarks"
          options={{ presentation: 'card', headerShown: true, title: 'Bookmarks' }}
        />

        {/* WEBVIEW - for events, cart, etc */}
        <Stack.Screen
          name="event-webview"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

// -----------------------------------------------------------------------------
// Root Layout
// -----------------------------------------------------------------------------

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
