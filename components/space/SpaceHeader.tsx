// =============================================================================
// SPACE HEADER - Cover photo, title, and metadata
// =============================================================================
// Displays space cover image, title, description, and member count
// =============================================================================

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Space } from '@/types';
import { formatCompactNumber } from '@/utils/formatNumber';

interface SpaceHeaderProps {
  space: Space;
}

export function SpaceHeader({ space }: SpaceHeaderProps) {
  const { colors: themeColors } = useTheme();
  const coverPhoto = space.cover_photo || space.logo;
  
  // API doesn't include counts in by-slug response, so hide the stats for now
  // Phase 2: Fetch member count from separate endpoint if needed
  const showStats = false;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      {/* Cover Photo */}
      {coverPhoto ? (
        <Image
          source={{ uri: coverPhoto }}
          style={styles.coverImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.coverImage, styles.coverPlaceholder, { backgroundColor: themeColors.primary }]}>
          <Text style={styles.coverEmoji}>
            {space.settings?.emoji || '🏠'}
          </Text>
        </View>
      )}

      {/* Space Info */}
      <View style={styles.infoContainer}>
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>
          {space.title}
        </Text>

        {space.description && (
          <Text style={[styles.description, { color: themeColors.textSecondary }]} numberOfLines={3}>
            {space.description}
          </Text>
        )}

        {/* Stats - Hidden for now, API doesn't return counts in by-slug */}
        {showStats && (
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statIcon}>👥</Text>
              <Text style={[styles.statText, { color: themeColors.textSecondary }]}>Members</Text>
            </View>

            <View style={[styles.statDivider, { backgroundColor: themeColors.border }]} />

            <View style={styles.stat}>
              <Text style={styles.statIcon}>📝</Text>
              <Text style={[styles.statText, { color: themeColors.textSecondary }]}>Posts</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
  },

  coverImage: {
    width: '100%',
    height: 200,
  },

  coverPlaceholder: {
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
    marginBottom: spacing.xs,
  },

  description: {
    fontSize: typography.size.md,
    lineHeight: typography.size.md * 1.5,
  },

  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
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
  },

  statDivider: {
    width: 1,
    height: 14,
    marginHorizontal: spacing.md,
  },
});

export default SpaceHeader;
