// =============================================================================
// EMPTY STATE - Display when list is empty
// =============================================================================
// Usage:
//   <EmptyState message="No posts yet" />
//   <EmptyState
//     icon="document-text-outline"
//     title="No posts"
//     message="Be the first to post!"
//     actionLabel="Create Post"
//     onAction={() => navigate('create')}
//   />
// =============================================================================

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface EmptyStateProps {
  // Ionicons icon name
  icon?: keyof typeof Ionicons.glyphMap;

  // Optional icon color (defaults to textTertiary)
  iconColor?: string;

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
  icon = 'mail-open-outline',
  iconColor,
  title,
  message,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={styles.container}>
      {/* Icon */}
      <Ionicons name={icon} size={56} color={iconColor || themeColors.textTertiary} style={styles.icon} />

      {/* Title */}
      {title && (
        <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
      )}

      {/* Message */}
      <Text style={[styles.message, { color: themeColors.textSecondary }]}>{message}</Text>
      
      {/* Action Button */}
      {actionLabel && onAction && (
        <TouchableOpacity style={[styles.actionButton, { backgroundColor: themeColors.primary }]} onPress={onAction}>
          <Text style={[styles.actionText, { color: themeColors.textInverse }]}>{actionLabel}</Text>
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
    marginBottom: spacing.md,
  },
  
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.xs,
  },

  message: {
    fontSize: typography.size.md,
    textAlign: 'center',
    lineHeight: typography.size.md * typography.lineHeight.normal,
  },

  actionButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
  },

  actionText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});

export default EmptyState;
