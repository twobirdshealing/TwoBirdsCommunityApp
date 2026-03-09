// =============================================================================
// SCREEN HEADER - Shared close/title/spacer header for full-screen panels
// =============================================================================
// Used by CommentSheet, BlogCommentSheet, and CreatePostContent.
// Renders: [X close] — centered title — [spacer]
// =============================================================================

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';

interface ScreenHeaderProps {
  title: string;
  onClose: () => void;
}

export const ScreenHeader = React.memo(function ScreenHeader({ title, onClose }: ScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      <Pressable
        onPress={onClose}
        style={styles.closeButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={24} color={colors.text} />
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <View style={styles.spacer} />
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },
  closeButton: {
    width: sizing.iconButton,
    height: sizing.iconButton,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spacer: {
    width: sizing.iconButton,
  },
});
