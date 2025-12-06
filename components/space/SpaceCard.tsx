// =============================================================================
// SPACE CARD - A single space/group card
// =============================================================================
// Displays space info with logo, name, description, and member count.
//
// Usage:
//   <SpaceCard 
//     space={spaceItem} 
//     onPress={() => navigate('space', { slug: space.slug })}
//   />
// =============================================================================

import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { Space } from '@/types';
import { formatCompactNumber } from '@/utils/formatNumber';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface SpaceCardProps {
  space: Space;
  onPress?: () => void;
  variant?: 'card' | 'list';
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SpaceCard({ 
  space, 
  onPress,
  variant = 'card',
}: SpaceCardProps) {
  const membersCount = space.members_count || 0;
  const postsCount = space.posts_count || 0;
  const isPrivate = space.privacy === 'private';
  const isMember = space.is_member;
  
  if (variant === 'list') {
    return (
      <TouchableOpacity 
        style={styles.listItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Logo */}
        {space.logo ? (
          <Image source={{ uri: space.logo }} style={styles.listLogo} />
        ) : (
          <View style={[styles.listLogo, styles.logoPlaceholder]}>
            <Text style={styles.logoEmoji}>
              {space.settings?.emoji || '👥'}
            </Text>
          </View>
        )}
        
        {/* Info */}
        <View style={styles.listInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.listName} numberOfLines={1}>{space.title}</Text>
            {isPrivate && <Text style={styles.lockIcon}>🔒</Text>}
          </View>
          <Text style={styles.listMeta}>
            {formatCompactNumber(membersCount)} members
          </Text>
        </View>
        
        {/* Status */}
        {isMember && (
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>Joined</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }
  
  return (
    <TouchableOpacity 
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Cover Photo */}
      {space.cover_photo ? (
        <Image 
          source={{ uri: space.cover_photo }} 
          style={styles.coverPhoto}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.coverPhoto, styles.coverPlaceholder]}>
          <Text style={styles.coverEmoji}>
            {space.settings?.emoji || '👥'}
          </Text>
        </View>
      )}
      
      {/* Content */}
      <View style={styles.cardContent}>
        {/* Logo (overlapping cover) */}
        <View style={styles.logoContainer}>
          {space.logo ? (
            <Image source={{ uri: space.logo }} style={styles.cardLogo} />
          ) : (
            <View style={[styles.cardLogo, styles.logoPlaceholder]}>
              <Text style={styles.logoEmoji}>
                {space.settings?.emoji || '👥'}
              </Text>
            </View>
          )}
        </View>
        
        {/* Title Row */}
        <View style={styles.titleRow}>
          <Text style={styles.cardName} numberOfLines={1}>{space.title}</Text>
          {isPrivate && <Text style={styles.lockIcon}>🔒</Text>}
        </View>
        
        {/* Description */}
        {space.description && (
          <Text style={styles.description} numberOfLines={2}>
            {space.description}
          </Text>
        )}
        
        {/* Stats */}
        <View style={styles.stats}>
          <Text style={styles.stat}>
            👥 {formatCompactNumber(membersCount)} members
          </Text>
          <Text style={styles.stat}>
            📝 {formatCompactNumber(postsCount)} posts
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Card variant
  card: {
    backgroundColor: colors.surface,
    borderRadius: sizing.borderRadius.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    overflow: 'hidden',
    ...shadows.sm,
  },
  
  coverPhoto: {
    width: '100%',
    height: 100,
    backgroundColor: colors.skeleton,
  },
  
  coverPlaceholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  coverEmoji: {
    fontSize: 40,
  },
  
  cardContent: {
    padding: spacing.lg,
  },
  
  logoContainer: {
    marginTop: -40,
    marginBottom: spacing.sm,
  },
  
  cardLogo: {
    width: 60,
    height: 60,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 3,
    borderColor: colors.surface,
    backgroundColor: colors.skeleton,
  },
  
  logoPlaceholder: {
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  logoEmoji: {
    fontSize: 24,
  },
  
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  cardName: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text,
    flex: 1,
  },
  
  lockIcon: {
    fontSize: 14,
    marginLeft: spacing.xs,
  },
  
  description: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: typography.size.sm * typography.lineHeight.normal,
  },
  
  stats: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  
  stat: {
    fontSize: typography.size.sm,
    color: colors.textTertiary,
    marginRight: spacing.lg,
  },
  
  // List variant
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    borderRadius: sizing.borderRadius.md,
    ...shadows.sm,
  },
  
  listLogo: {
    width: 48,
    height: 48,
    borderRadius: sizing.borderRadius.md,
    backgroundColor: colors.skeleton,
  },
  
  listInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  listName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    color: colors.text,
    flex: 1,
  },
  
  listMeta: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  
  memberBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.sm,
  },
  
  memberBadgeText: {
    fontSize: typography.size.xs,
    color: colors.success,
    fontWeight: typography.weight.medium,
  },
});

export default SpaceCard;
