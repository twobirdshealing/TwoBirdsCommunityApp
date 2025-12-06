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
import { colors } from '@/constants/colors';
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
  color = colors.primary,
}: LoadingSpinnerProps) {
  const content = (
    <>
      <ActivityIndicator size={size} color={color} />
      {message && (
        <Text style={styles.message}>{message}</Text>
      )}
    </>
  );
  
  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
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
    backgroundColor: colors.background,
  },
  
  inline: {
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  message: {
    marginTop: spacing.md,
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },
});

export default LoadingSpinner;
