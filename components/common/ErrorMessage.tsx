// =============================================================================
// ERROR MESSAGE - Display errors with retry option
// =============================================================================
// Usage:
//   <ErrorMessage message="Something went wrong" />
//   <ErrorMessage message="Network error" onRetry={() => refetch()} />
// =============================================================================

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ErrorMessageProps {
  // Error message to display
  message: string;
  
  // Optional retry callback
  onRetry?: () => void;
  
  // Full screen or inline
  fullScreen?: boolean;
  
  // Custom title
  title?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ErrorMessage({
  message,
  onRetry,
  fullScreen = true,
  title = 'Oops!',
}: ErrorMessageProps) {
  const content = (
    <View style={styles.content}>
      {/* Error Icon */}
      <Text style={styles.icon}>😕</Text>
      
      {/* Title */}
      <Text style={styles.title}>{title}</Text>
      
      {/* Message */}
      <Text style={styles.message}>{message}</Text>
      
      {/* Retry Button */}
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      )}
    </View>
  );
  
  if (fullScreen) {
    return (
      <View style={styles.fullScreen}>
        {content}
      </View>
    );
  }
  
  return content;
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
    padding: spacing.xl,
  },
  
  content: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  
  icon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  
  message: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
  },
  
  retryText: {
    color: colors.textInverse,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});

export default ErrorMessage;
