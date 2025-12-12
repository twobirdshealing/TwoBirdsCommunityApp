// =============================================================================
// SPACES TAB - Display user's joined spaces  
// =============================================================================

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { Space } from '@/types';
import { formatCompactNumber } from '@/utils/formatNumber';

interface SpacesTabProps {
  spaces: Space[];
  loading?: boolean;
}

export function SpacesTab({ spaces, loading }: SpacesTabProps) {
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Loading spaces...</Text>
      </View>
    );
  }

  if (spaces.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏠</Text>
        <Text style={styles.emptyText}>No spaces joined yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {spaces.map((space) => {
        const coverPhoto = space.cover_photo || space.logo;
        const membersCount = space.members_count || 0;

        return (
          <View key={space.id} style={styles.spaceCard}>
            {coverPhoto ? (
              <Image
                source={{ uri: coverPhoto }}
                style={styles.spaceCover}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.spaceCover, styles.spaceCoverPlaceholder]}>
                <Text style={styles.spaceCoverEmoji}>
                  {space.settings?.emoji || '🏠'}
                </Text>
              </View>
            )}

            <View style={styles.spaceInfo}>
              <Text style={styles.spaceTitle} numberOfLines={2}>
                {space.title}
              </Text>
              
              {space.description && (
                <Text style={styles.spaceDescription} numberOfLines={2}>
                  {space.description}
                </Text>
              )}

              <View style={styles.spaceMeta}>
                <Text style={styles.spaceMetaIcon}>👥</Text>
                <Text style={styles.spaceMetaText}>
                  {formatCompactNumber(membersCount)} member{membersCount !== 1 ? 's' : ''}
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.viewButton} 
                onPress={() => router.push(`/space/${space.slug}`)}
              >
                <Text style={styles.viewButtonText}>View Space</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
  },

  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },

  spaceCard: {
    backgroundColor: colors.surface,
    borderRadius: sizing.borderRadius.lg,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },

  spaceCover: {
    width: '100%',
    height: 120,
    backgroundColor: colors.skeleton,
  },

  spaceCoverPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  spaceCoverEmoji: {
    fontSize: 48,
  },

  spaceInfo: {
    padding: spacing.lg,
  },

  spaceTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  spaceDescription: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: typography.size.sm * 1.5,
  },

  spaceMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  spaceMetaIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },

  spaceMetaText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  viewButton: {
    backgroundColor: colors.backgroundSecondary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: sizing.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },

  viewButtonText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.text,
  },
});

export default SpacesTab;
