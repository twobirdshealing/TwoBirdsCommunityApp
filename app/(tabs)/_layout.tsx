// =============================================================================
// ROOT LAYOUT - App-wide configuration with Authentication
// =============================================================================

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

// -----------------------------------------------------------------------------
// Auth Guard - Redirects based on auth state
// -----------------------------------------------------------------------------

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    // Don't do anything while loading
    if (isLoading) return;

    // Check if user is on login screen
    const isOnLogin = segments[0] === 'login';

    if (!isAuthenticated && !isOnLogin) {
      // Not logged in and not on login page -> redirect to login
      router.replace('/login');
    } else if (isAuthenticated && isOnLogin) {
      // Logged in but on login page -> redirect to main app
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  return <>{children}</>;
}

// -----------------------------------------------------------------------------
// Navigation Stack
// -----------------------------------------------------------------------------

function RootStack() {
  return (
    <>
      <Stack>
        {/* Login Screen */}
        <Stack.Screen 
          name="login" 
          options={{ 
            headerShown: false,
            // Prevent going back to login after logging in
            gestureEnabled: false,
          }} 
        />
        
        {/* Main App (Tabs) */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        
        {/* Feed Detail */}
        <Stack.Screen 
          name="feed/[id]" 
          options={{ headerShown: false }} 
        />
        
        {/* Modal */}
        <Stack.Screen 
          name="modal" 
          options={{ presentation: 'modal', title: 'Modal' }} 
        />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}

// -----------------------------------------------------------------------------
// Root Layout (wraps everything with providers)
// -----------------------------------------------------------------------------

export default function RootLayout() {
  return (
    <AuthProvider>
      <AuthGuard>
        <RootStack />
      </AuthGuard>
    </AuthProvider>
  );
}

export const unstable_settings = {
  // Start on tabs if authenticated, login handles redirect
  initialRouteName: '(tabs)',
};