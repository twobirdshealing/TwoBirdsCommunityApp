// =============================================================================
// WEBVIEW SCREEN - Reusable authenticated WebView
// =============================================================================
// Route: /webview?url={url}&title={title}
// Uses PageHeader for consistent header styling
//
// Params:
//   url         - Required: The URL to load
//   title       - Required: Header title
//
// Usage:
//   router.push({ pathname: '/webview', params: { url, title } })
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation, WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, typography, sizing } from '@/constants/layout';
import { APP_USER_AGENT } from '@/constants/config';
import { appApi } from '@/services/api/app';
import { PageHeader, HeaderTitle } from '@/components/navigation/PageHeader';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { useTheme } from '@/contexts/ThemeContext';
import { getThemeInjectionScript } from '@/utils/webviewTheme';
import { createLogger } from '@/utils/logger';

const log = createLogger('WebView');

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function WebViewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const params = useLocalSearchParams<{
    url?: string;
    title?: string;
    noAuth?: string;      // Skip session creation, load URL directly (for public pages)
  }>();

  const webViewRef = useRef<WebView>(null);

  const themeInjectionScript = useMemo(() => getThemeInjectionScript(isDark), [isDark]);

  // State
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [canGoBack, setCanGoBack] = useState(false);
  const [pageTitle, setPageTitle] = useState(params.title || 'Loading...');
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Create Session
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const initSession = async () => {
      const url = params.url;

      log.debug('Init with URL:', { url });

      if (!url) {
        setError('No URL provided');
        setLoading(false);
        return;
      }

      // Public pages (e.g., privacy policy) don't need authentication
      if (params.noAuth) {
        log.debug('Loading public URL (noAuth):', { url });
        setSessionUrl(url);
        setLoading(false);
        return;
      }

      try {
        log.debug('Creating session...');
        const response = await appApi.createWebSession(url);

        log.debug('Session created:', { success: response.success });

        if (response.success && response.url) {
          setSessionUrl(response.url);
        } else {
          throw new Error('Invalid session response');
        }
      } catch (err) {
        log.debug('Error:', { err });
        const message = err instanceof Error ? err.message : 'Failed to load';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    initSession();
  }, [params.url, params.noAuth]);

  // ---------------------------------------------------------------------------
  // Theme Sync - Re-inject when dark mode toggles while webview is open
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (sessionUrl && webViewRef.current) {
      webViewRef.current.injectJavaScript(themeInjectionScript);
    }
  }, [isDark]);

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

  const handleNavigationChange = (navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    if (navState.title) {
      setPageTitle(navState.title);
    }
  };

  const handleError = useCallback((event: WebViewErrorEvent) => {
    const { description } = event.nativeEvent;
    log.debug('Load error:', { description });
    setError(description || 'Failed to load page');
  }, []);

  const handleHttpError = useCallback((event: WebViewHttpErrorEvent) => {
    const { statusCode, description } = event.nativeEvent;
    log.debug('HTTP error:', { statusCode, description });
    if (statusCode >= 400) {
      setError(`Page returned error ${statusCode}`);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: Error
  // ---------------------------------------------------------------------------

  if (error) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header */}
        <PageHeader
          left={<HeaderIconButton icon="close" onPress={handleClose} />}
          center={<HeaderTitle>Error</HeaderTitle>}
        />

        {/* Error Content */}
        <View style={styles.centered}>
          <View style={[styles.errorIcon, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.textTertiary} />
          </View>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Something went wrong</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Render: WebView
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header - Using PageHeader component */}
      <PageHeader
        left={canGoBack ? <HeaderIconButton icon="chevron-back" onPress={handleBack} /> : <HeaderIconButton icon="close" onPress={handleBack} />}
        center={<HeaderTitle>{pageTitle}</HeaderTitle>}
      />

      {/* WebView with custom User-Agent + theme sync */}
      {sessionUrl && (
        <WebView
          ref={webViewRef}
          source={{ uri: sessionUrl }}
          style={styles.webView}
          userAgent={APP_USER_AGENT}
          onNavigationStateChange={handleNavigationChange}
          onError={handleError}
          onHttpError={handleHttpError}
          incognito={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          injectedJavaScript={themeInjectionScript}
          renderLoading={() => (
            <View style={[styles.webViewLoading, { backgroundColor: colors.background }]}>
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
  },

  // Error
  errorIcon: {
    width: 120,
    height: 120,
    borderRadius: sizing.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },

  errorTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.sm,
  },

  errorText: {
    fontSize: typography.size.md,
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
  },
});
