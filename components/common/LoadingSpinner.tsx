// =============================================================================
// LOADING SPINNER - Full screen or inline loading indicator
// =============================================================================
// Usage:
//   <LoadingSpinner />                    // Full screen
//   <LoadingSpinner fullScreen={false} /> // Inline
//   <LoadingSpinner message="Loading posts..." />
// =============================================================================

import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface LoadingSpinnerProps {
  // Show as full screen overlay
  fullScreen?: boolean;
  
  // Optional message below spinner
  message?: string;
  
  // Spinner size
  size?: 'small' | 'large';
  
  // Custom color
  color?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function LoadingSpinner({
  fullScreen = true,
  message,
  size = 'large',
  color,
}: LoadingSpinnerProps) {
  const { colors: themeColors } = useTheme();
  const spinnerColor = color || themeColors.primary;

  const content = (
    <>
      <ActivityIndicator size={size} color={spinnerColor} />
      {message && (
        <Text style={[styles.message, { color: themeColors.textSecondary }]}>{message}</Text>
      )}
    </>
  );

  if (fullScreen) {
    return (
      <View style={[styles.fullScreen, { backgroundColor: themeColors.background }]}>
        {content}
      </View>
    );
  }
  
  return (
    <View style={styles.inline}>
      {content}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  inline: {
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },

  message: {
    marginTop: spacing.md,
    fontSize: typography.size.md,
  },
});

export default LoadingSpinner;
