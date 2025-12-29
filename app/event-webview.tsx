// =============================================================================
// EVENT WEBVIEW SCREEN - Full-screen authenticated WebView for events
// =============================================================================
// Route: /event-webview?eventUrl={url}&title={title}
// Full-screen modal - matches feed/[id] pattern
// Features:
// - Native header with back button and title (matches profile, messages style)
// - Cart icon with badge
// - Maintains WordPress session via cookies
// - Loading states and error handling
// =============================================================================

import React, { useEffect, useState, useRef, useCallback } from 'react';
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
import { useCart } from '@/contexts/CartContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface WebViewState {
  loading: boolean;
  canGoBack: boolean;
  title: string;
  error: string | null;
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function EventWebViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { count: cartCount, refresh: refreshCart } = useCart();
  const params = useLocalSearchParams<{ 
    eventUrl?: string;
    title?: string;
  }>();
  
  const webViewRef = useRef<WebView>(null);
  
  // State
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [webViewState, setWebViewState] = useState<WebViewState>({
    loading: true,
    canGoBack: false,
    title: params.title || 'Event',
    error: null,
  });
  const [creatingSession, setCreatingSession] = useState(true);

  // Create authenticated session on mount
  useEffect(() => {
    const initSession = async () => {
      console.log('[EventWebView] Starting session initialization');
      console.log('[EventWebView] Params:', params);
      
      try {
        const eventUrl = params.eventUrl;
        
        if (!eventUrl) {
          console.log('[EventWebView] ERROR: No event URL provided');
          throw new Error('No event URL provided');
        }
        
        console.log('[EventWebView] Creating session for:', eventUrl);
        
        // Create one-time login session
        const response = await appApi.createWebSession(eventUrl);
        
        console.log('[EventWebView] Session response:', response);
        
        if (response.success && response.url) {
          console.log('[EventWebView] Got session URL, length:', response.url.length);
          setSessionUrl(response.url);
        } else {
          console.log('[EventWebView] Invalid response:', response);
          throw new Error('Failed to create session');
        }
      } catch (error) {
        console.log('[EventWebView] Error:', error);
        const message = error instanceof Error ? error.message : 'Failed to load event';
        setWebViewState(prev => ({ ...prev, error: message, loading: false }));
      } finally {
        setCreatingSession(false);
      }
    };
    
    initSession();
  }, [params.eventUrl]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (webViewState.canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    } else {
      router.back();
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleCartPress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    try {
      const response = await appApi.getCart();
      if (response.success && response.cart.cart_url) {
        // Navigate WebView to cart
        const cartSession = await appApi.createWebSession(response.cart.cart_url);
        if (cartSession.success && cartSession.url && webViewRef.current) {
          webViewRef.current.injectJavaScript(
            `window.location.href = '${cartSession.url}'; true;`
          );
        }
      }
    } catch {
      // Silent fail
    }
  };

  const handleNavigationStateChange = (navState: WebViewNavigation) => {
    setWebViewState(prev => ({
      ...prev,
      canGoBack: navState.canGoBack,
      title: navState.title || prev.title,
      loading: navState.loading,
    }));
    
    // Refresh cart count when navigation changes (user might have added to cart)
    if (!navState.loading) {
      refreshCart();
    }
  };

  const handleLoadEnd = () => {
    setWebViewState(prev => ({ ...prev, loading: false }));
  };

  const handleError = () => {
    setWebViewState(prev => ({
      ...prev,
      loading: false,
      error: 'Failed to load page. Please try again.',
    }));
  };

  // ---------------------------------------------------------------------------
  // Render: Loading (creating session)
  // ---------------------------------------------------------------------------

  if (creatingSession) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading event...</Text>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Error
  // ---------------------------------------------------------------------------

  if (webViewState.error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.headerButton} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={styles.headerButton} />
        </View>
        
        {/* Error Content */}
        <View style={styles.errorContainer}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.textTertiary} />
          </View>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{webViewState.error}</Text>
          <Pressable style={styles.retryButton} onPress={handleClose}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Main
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Custom Header - matches TopHeader style */}
      <View style={styles.header}>
        {/* Left: Back/Close button */}
        <Pressable 
          onPress={handleBack} 
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.headerButtonPressed,
          ]} 
          hitSlop={8}
        >
          <Ionicons 
            name={webViewState.canGoBack ? "chevron-back" : "close"} 
            size={24} 
            color={colors.text} 
          />
        </Pressable>
        
        {/* Center: Title + Loading */}
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {webViewState.title}
          </Text>
          {webViewState.loading && (
            <ActivityIndicator 
              size="small" 
              color={colors.primary} 
              style={styles.headerLoader} 
            />
          )}
        </View>
        
        {/* Right: Cart icon (matches HeaderIconButton style) */}
        <Pressable 
          onPress={handleCartPress} 
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.headerButtonPressed,
          ]} 
          hitSlop={8}
        >
          <Ionicons name="cart-outline" size={24} color={colors.text} />
          {cartCount > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {cartCount > 99 ? '99+' : cartCount}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
      
      {/* WebView */}
      {sessionUrl && (
        <WebView
          ref={webViewRef}
          source={{ uri: sessionUrl }}
          style={styles.webView}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadEnd={handleLoadEnd}
          onError={handleError}
          // Cookie and session settings
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          // JS and storage
          javaScriptEnabled={true}
          domStorageEnabled={true}
          // UX improvements
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          )}
          // Security
          originWhitelist={['https://*', 'http://*']}
          // Allow payment flows
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles - matches existing app patterns
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header - matches TopHeader style
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
    opacity: 0.7,
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
    textAlign: 'center',
  },

  headerLoader: {
    marginLeft: spacing.xs,
  },

  // Cart badge - matches HeaderIconButton style
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },

  cartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
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

  // Loading state - matches messages/notifications empty state
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },

  loadingText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },

  // Error state - matches existing empty states
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },

  errorIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
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
    maxWidth: 280,
  },

  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginTop: spacing.lg,
  },

  retryButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: '#fff',
  },
});
