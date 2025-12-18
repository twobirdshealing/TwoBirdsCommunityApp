// =============================================================================
// ROOT LAYOUT - App-wide configuration with Authentication
// =============================================================================
// FIXED: Route registrations match actual file structure
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
        {/* ============================================= */}
        {/* TABS - Always visible base layer             */}
        {/* ============================================= */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }}
        />
        
        {/* ============================================= */}
        {/* AUTH                                          */}
        {/* ============================================= */}
        <Stack.Screen 
          name="login" 
          options={{ headerShown: false }}
        />
        
        {/* ============================================= */}
        {/* SPACE ROUTES                                  */}
        {/* Folder: app/space/[slug]/                     */}
        {/* - index.tsx = Space detail page               */}
        {/* - members.tsx = Members list                  */}
        {/* ============================================= */}
        
        {/* Space detail - maps to app/space/[slug]/index.tsx */}
        <Stack.Screen 
          name="space/[slug]/index" 
          options={{ 
            headerShown: false,
          }} 
        />
        
        {/* Space members - maps to app/space/[slug]/members.tsx */}
        <Stack.Screen 
          name="space/[slug]/members" 
          options={{ 
            headerShown: true,
            title: 'Members',
          }} 
        />
        
        {/* ============================================= */}
        {/* FEED DETAIL                                   */}
        {/* ============================================= */}
        
        {/* Full-screen post viewer */}
        <Stack.Screen 
          name="feed/[id]" 
          options={{ 
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }} 
        />
        
        {/* ============================================= */}
        {/* PROFILE ROUTES                                */}
        {/* ============================================= */}
        
        {/* Profile detail page (other users) */}
        {/* Maps to app/profile/[username].tsx */}
        <Stack.Screen 
          name="profile/[username]" 
          options={{ 
            presentation: 'card',
            headerShown: true,
          }} 
        />
        
        {/* ============================================= */}
        {/* MODALS (Uncomment when files exist)           */}
        {/* ============================================= */}
        
        {/* Create post modal - uncomment when app/create-post.tsx exists
        <Stack.Screen 
          name="create-post" 
          options={{ 
            presentation: 'modal',
            headerShown: true,
            title: 'Create Post',
          }} 
        />
        */}
        
        {/* Media viewer modal - uncomment when app/media-viewer.tsx exists
        <Stack.Screen 
          name="media-viewer" 
          options={{ 
            presentation: 'fullScreenModal',
            headerShown: false,
          }} 
        />
        */}
        
        {/* Generic modal fallback - uncomment when app/modal.tsx exists
        <Stack.Screen 
          name="modal" 
          options={{ presentation: 'modal' }} 
        />
        */}
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
