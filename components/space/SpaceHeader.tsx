// =============================================================================
// SPACE HEADER - Cover photo, title, and metadata
// =============================================================================
// Displays space cover image, title, description, and member count
// =============================================================================

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { Space } from '@/types';
import { formatCompactNumber } from '@/utils/formatNumber';

interface SpaceHeaderProps {
  space: Space;
}

export function SpaceHeader({ space }: SpaceHeaderProps) {
  const coverPhoto = space.cover_photo || space.logo;
  const membersCount = space.members_count || 0;
  const postsCount = space.posts_count || 0;

  return (
    <View style={styles.container}>
      {/* Cover Photo */}
      {coverPhoto ? (
        <Image
          source={{ uri: coverPhoto }}
          style={styles.coverImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.coverImage, styles.coverPlaceholder]}>
          <Text style={styles.coverEmoji}>
            {space.settings?.emoji || '🏠'}
          </Text>
        </View>
      )}

      {/* Space Info */}
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={2}>
          {space.title}
        </Text>

        {space.description && (
          <Text style={styles.description} numberOfLines={3}>
            {space.description}
          </Text>
        )}

        {/* Stats */}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statText}>
              {formatCompactNumber(membersCount)} member{membersCount !== 1 ? 's' : ''}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.stat}>
            <Text style={styles.statIcon}>📝</Text>
            <Text style={styles.statText}>
              {formatCompactNumber(postsCount)} post{postsCount !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  coverImage: {
    width: '100%',
    height: 200,
    backgroundColor: colors.skeleton,
  },

  coverPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  coverEmoji: {
    fontSize: 64,
  },

  infoContainer: {
    padding: spacing.lg,
  },

  title: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  description: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    lineHeight: typography.size.md * 1.5,
    marginBottom: spacing.md,
  },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  stat: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  statIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },

  statText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
});

export default SpaceHeader;
