// =============================================================================
// ERROR BOUNDARY - Catches unhandled render errors, prevents full app crash
// =============================================================================
// Wraps Sentry's ErrorBoundary so React render errors are automatically
// captured (with full component stack) when crash reporting is enabled.
// Falls back to a friendly retry screen instead of a white screen crash.
// When Sentry isn't initialized, behavior is identical to a plain boundary.
// =============================================================================

import * as Sentry from '@sentry/react-native';
import React, { ReactNode } from 'react';
import {
  Appearance,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sizing, spacing, typography } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
}

export function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ resetError }) => <ErrorFallback onRetry={resetError} />}
      onError={(error, componentStack) => {
        // Sentry captures these in production; dev console still needs the
        // stack so developers see the failure immediately without switching
        // to the Sentry dashboard.
        if (__DEV__) {
          console.error('[ErrorBoundary]', error, componentStack);
        }
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

// -----------------------------------------------------------------------------
// Fallback UI — standalone (no ThemeProvider dependency)
// -----------------------------------------------------------------------------
// Uses Appearance API directly since this renders OUTSIDE the ThemeProvider
// when the error occurs at the provider level.

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const isDark = Appearance.getColorScheme() === 'dark';
  const bg = isDark ? '#1a1a2e' : '#f8f9fa';
  const text = isDark ? '#e8e8e8' : '#1a1a2e';
  const textSecondary = isDark ? '#a0a0a0' : '#6b7280';
  const buttonBg = isDark ? '#555555' : '#333333';
  const buttonText = '#ffffff';

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={styles.icon}>😕</Text>
      <Text style={[styles.title, { color: text }]}>Something went wrong</Text>
      <Text style={[styles.message, { color: textSecondary }]}>
        An unexpected error occurred. Please try again.
      </Text>
      <Pressable
        style={[styles.retryButton, { backgroundColor: buttonBg }]}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Try again"
      >
        <Text style={[styles.retryText, { color: buttonText }]}>Try Again</Text>
      </Pressable>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },

  icon: {
    fontSize: sizing.icon.xxl,
    marginBottom: spacing.lg,
  },

  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    marginBottom: spacing.sm,
  },

  message: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },

  retryButton: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: 14,
    borderRadius: sizing.borderRadius.sm,
  },

  retryText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});

export default ErrorBoundary;
