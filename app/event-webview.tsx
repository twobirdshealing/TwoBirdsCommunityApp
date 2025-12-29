// =============================================================================
// WEBVIEW SCREEN - Authenticated WebView for events, cart, etc.
// =============================================================================
// Route: /event-webview?eventUrl={url}&title={title}
// Uses PageHeader for consistent header styling
// =============================================================================

import React, { useEffect, useState, useRef } from 'react';
import {
  ActivityIndicator,
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
import { SITE_URL } from '@/constants/config';
import { appApi } from '@/services/api/app';
import { PageHeader } from '@/components/navigation';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// Custom User-Agent for WordPress to detect app WebView
const APP_USER_AGENT = 'TBCCommunityApp/1.0';

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
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    } else {
      router.back();
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleCartPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      // Create new session for cart page
      const cartUrl = `${SITE_URL}/cart/`;
      const response = await appApi.createWebSession(cartUrl);
      
      if (response.success && response.url && webViewRef.current) {
        // Navigate WebView to cart
        webViewRef.current.injectJavaScript(
          `window.location.href = '${response.url}'; true;`
        );
        setPageTitle('Cart');
      }
    } catch (err) {
      console.log('[WebView] Cart error:', err);
    }
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
        <PageHeader
          leftAction="close"
          onLeftPress={handleClose}
          title="Error"
        />
        
        {/* Error Content */}
        <View style={styles.centered}>
          <View style={styles.errorIcon}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.textTertiary} />
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{error}</Text>
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
      
      {/* Header - Using PageHeader component */}
      <PageHeader
        leftAction={canGoBack ? 'back' : 'close'}
        onLeftPress={handleBack}
        title={pageTitle}
        showLoader={pageLoading}
        rightIcon="cart-outline"
        onRightPress={handleCartPress}
      />
      
      {/* WebView with custom User-Agent */}
      {sessionUrl && (
        <WebView
          ref={webViewRef}
          source={{ uri: sessionUrl }}
          style={styles.webView}
          userAgent={APP_USER_AGENT}
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
// Styles (header styles removed - now in PageHeader component)
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
