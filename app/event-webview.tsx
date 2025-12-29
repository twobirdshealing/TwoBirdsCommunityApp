// =============================================================================
// WEBVIEW SCREEN - Authenticated WebView for events, cart, etc.
// =============================================================================
// Route: /event-webview?eventUrl={url}&title={title}
// SIMPLIFIED: Just creates session and shows WebView
// =============================================================================

import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { appApi } from '@/services/api/app';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function WebViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ 
    eventUrl?: string;
    title?: string;
  }>();
  
  const webViewRef = useRef<WebView>(null);
  
  // State
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [pageTitle, setPageTitle] = useState(params.title || 'Loading...');
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Create Session
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const initSession = async () => {
      const eventUrl = params.eventUrl;
      
      console.log('[WebView] Init with URL:', eventUrl);
      
      if (!eventUrl) {
        setError('No URL provided');
        setLoading(false);
        return;
      }
      
      try {
        console.log('[WebView] Creating session...');
        const response = await appApi.createWebSession(eventUrl);
        
        console.log('[WebView] Session created:', response.success);
        
        if (response.success && response.url) {
          setSessionUrl(response.url);
        } else {
          throw new Error('Invalid session response');
        }
      } catch (err) {
        console.log('[WebView] Error:', err);
        const message = err instanceof Error ? err.message : 'Failed to load';
        setError(message);
      } finally {
        setLoading(false);
      }
    };
    
    initSession();
  }, [params.eventUrl]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    } else {
      router.back();
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleNavigationChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    setPageLoading(navState.loading);
    if (navState.title) {
      setPageTitle(navState.title);
    }
  };

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Error
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={styles.headerButton} />
        </View>
        
        {/* Error */}
        <View style={styles.centered}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.textTertiary} />
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.button} onPress={handleClose}>
            <Text style={styles.buttonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: WebView
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <Pressable 
          onPress={handleBack} 
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.headerButtonPressed,
          ]}
        >
          <Ionicons 
            name={canGoBack ? "chevron-back" : "close"} 
            size={24} 
            color={colors.text} 
          />
        </Pressable>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {pageTitle}
          </Text>
          {pageLoading && (
            <ActivityIndicator 
              size="small" 
              color={colors.primary} 
              style={styles.headerLoader} 
            />
          )}
        </View>
        
        <Pressable 
          onPress={handleClose} 
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.headerButtonPressed,
          ]}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>
      
      {/* WebView */}
      {sessionUrl && (
        <WebView
          ref={webViewRef}
          source={{ uri: sessionUrl }}
          style={styles.webView}
          onNavigationStateChange={handleNavigationChange}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },

  headerButtonPressed: {
    backgroundColor: colors.backgroundSecondary,
  },

  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.sm,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },

  headerLoader: {
    marginLeft: spacing.xs,
  },

  // Loading
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },

  // Error
  errorIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },

  errorTitle: {
    fontSize: typography.size.xl,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },

  errorText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  button: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },

  buttonText: {
    color: '#fff',
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  // WebView
  webView: {
    flex: 1,
  },

  webViewLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
