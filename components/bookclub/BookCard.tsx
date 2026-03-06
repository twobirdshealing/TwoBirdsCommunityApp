// =============================================================================
// BOOK CARD - List item for book browsing
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import type { BookSummary } from '@/types/bookclub';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface BookCardProps {
  book: BookSummary;
  onPress: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function BookCard({ book, onPress }: BookCardProps) {
  const { colors: themeColors } = useTheme();

  return (
    <AnimatedPressable
      style={[styles.card, { backgroundColor: themeColors.surface }]}
      onPress={onPress}
    >
      {/* Cover Image */}
      {book.cover_image ? (
        <Image source={{ uri: book.cover_image }} style={styles.cover} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}>
          <Ionicons name="book-outline" size={32} color={themeColors.primary} />
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>
            {book.title}
          </Text>
          {book.is_current && (
            <View style={[styles.currentBadge, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}>
              <Text style={[styles.currentBadgeText, { color: themeColors.primary }]}>Current</Text>
            </View>
          )}
        </View>

        <Text style={[styles.author, { color: themeColors.textSecondary }]} numberOfLines={1}>
          {book.author}
        </Text>

        <Text style={[styles.meta, { color: themeColors.textTertiary }]}>
          {book.chapter_count} chapter{book.chapter_count !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Chevron */}
      <Ionicons name="chevron-forward" size={20} color={themeColors.textTertiary} />
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: sizing.borderRadius.md,
    gap: spacing.md,
  },

  cover: {
    width: 60,
    height: 60,
    borderRadius: sizing.borderRadius.sm,
  },

  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  info: {
    flex: 1,
    gap: 2,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  title: {
    fontSize: typography.size.md,
    fontWeight: '600',
    flex: 1,
  },

  currentBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: sizing.borderRadius.full,
  },

  currentBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: '600',
  },

  author: {
    fontSize: typography.size.sm,
  },

  meta: {
    fontSize: typography.size.xs,
  },
});

export default BookCard;
