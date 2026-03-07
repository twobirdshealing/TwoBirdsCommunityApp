// =============================================================================
// ERROR BOUNDARY - Catches unhandled render errors, prevents full app crash
// =============================================================================
// Wraps the root layout. Falls back to a friendly retry screen instead of
// a white screen crash. Class component required (React has no hook equivalent).
// =============================================================================

import React, { Component, ReactNode } from 'react';
import {
  Appearance,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { sizing, spacing, typography } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Props & State
// -----------------------------------------------------------------------------

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (__DEV__) {
      console.error('[ErrorBoundary]', error, errorInfo.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
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
  const buttonBg = '#6366F1';
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
