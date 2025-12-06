// =============================================================================
// EMPTY STATE - Display when list is empty
// =============================================================================
// Usage:
//   <EmptyState message="No posts yet" />
//   <EmptyState 
//     icon="📝" 
//     title="No posts" 
//     message="Be the first to post!" 
//     actionLabel="Create Post"
//     onAction={() => navigate('create')}
//   />
// =============================================================================

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface EmptyStateProps {
  // Emoji or icon
  icon?: string;
  
  // Title text
  title?: string;
  
  // Description message
  message: string;
  
  // Optional action button
  actionLabel?: string;
  onAction?: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function EmptyState({
  icon = '📭',
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {/* Icon */}
      <Text style={styles.icon}>{icon}</Text>
      
      {/* Title */}
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}
      
      {/* Message */}
      <Text style={styles.message}>{message}</Text>
      
      {/* Action Button */}
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionButton} onPress={onAction}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    minHeight: 300,
  },
  
  icon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  
  message: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },
  
  actionButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
  },
  
  actionText: {
    color: colors.textInverse,
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});

export default EmptyState;
