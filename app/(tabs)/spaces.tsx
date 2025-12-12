// =============================================================================
// SPACES SCREEN - List of all community spaces
// =============================================================================
// Shows all available spaces the user can join or browse
// Phase 1: Simple list, Phase 2: Add search, filters, categories
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { Space } from '@/types';
import { spacesApi } from '@/services/api';
import { LoadingSpinner, ErrorMessage } from '@/components/common';
import { formatCompactNumber } from '@/utils/formatNumber';

export default function SpacesScreen() {
  const router = useRouter();

  // State
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch Spaces
  // ---------------------------------------------------------------------------

  const fetchSpaces = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }

      const response = await spacesApi.getSpaces({ per_page: 50 });

      if (response.success) {
        setSpaces(response.data.spaces || []);
      } else {
        setError(response.error?.message || 'Failed to load spaces');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSpacePress = (space: Space) => {
    router.push(`/space/${space.slug}`);
  };

  // ---------------------------------------------------------------------------
  // Render States
  // ---------------------------------------------------------------------------

  if (loading) {
    return <LoadingSpinner message="Loading spaces..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={() => fetchSpaces(true)} />;
  }

  if (spaces.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏠</Text>
        <Text style={styles.emptyText}>No spaces available</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => fetchSpaces(true)}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {spaces.map((space) => {
        const coverPhoto = space.cover_photo || space.logo;
        const membersCount = space.members_count || 0;

        return (
          <TouchableOpacity
            key={space.id}
            style={styles.spaceCard}
            onPress={() => handleSpacePress(space)}
            activeOpacity={0.7}
          >
            {/* Cover Photo */}
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

            {/* Space Info */}
            <View style={styles.spaceInfo}>
              <Text style={styles.spaceTitle} numberOfLines={2}>
                {space.title}
              </Text>

              {space.description && (
                <Text style={styles.spaceDescription} numberOfLines={2}>
                  {space.description}
                </Text>
              )}

              {/* Members Count */}
              <View style={styles.spaceMeta}>
                <Text style={styles.spaceMetaIcon}>👥</Text>
                <Text style={styles.spaceMetaText}>
                  {formatCompactNumber(membersCount)} member{membersCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  content: {
    padding: spacing.lg,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
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
  },

  spaceMetaIcon: {
    fontSize: 14,
    marginRight: spacing.xs,
  },

  spaceMetaText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },
});
