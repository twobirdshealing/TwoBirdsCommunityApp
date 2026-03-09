// =============================================================================
// SPACE CARD COMPONENT - Hero-style card for space displays
// =============================================================================
// Cover image with gradient overlay, title + stats on hero, badges below.
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { Space } from '@/types/space';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { stripHtmlTags } from '@/utils/htmlToText';

interface SpaceCardProps {
  space: Space;
  onPress: () => void;
}

const getPrivacyIcon = (privacy: string): keyof typeof Ionicons.glyphMap => {
  switch (privacy) {
    case 'public': return 'globe-outline';
    case 'private': return 'lock-closed-outline';
    case 'secret': return 'eye-off-outline';
    default: return 'globe-outline';
  }
};

export const SpaceCard = React.memo(function SpaceCard({ space, onPress }: SpaceCardProps) {
  const { colors: themeColors } = useTheme();

  // Card cover: og_image (card preview) → cover_photo (banner) → placeholder
  // Filter out Fluent default placeholder images so our themed fallback shows
  const isPlaceholder = (url?: string | null) => url?.includes('fluent-community/assets/images/');
  const coverImage = (!isPlaceholder(space.settings?.og_image) && space.settings?.og_image?.trim() || null)
    ?? (!isPlaceholder(space.cover_photo) && space.cover_photo?.trim() || null);
  const hasLogo = space.logo && space.logo.trim() !== '';
  const hasEmoji = space.settings?.emoji && space.settings.emoji.trim() !== '';

  // Membership from discover (space_pivot) or profile (pivot) endpoint
  const pivot = space.space_pivot ?? space.pivot;
  const isPending = pivot?.status === 'pending';
  const isMember = pivot != null && !isPending;
  const role = pivot?.role;
  const isRoleBadge = isMember && (role === 'admin' || role === 'moderator');
  const hideMemberCount = space.settings?.hide_members_count === 'yes';

  return (
    <AnimatedPressable onPress={onPress} style={[styles.card, { backgroundColor: themeColors.surface }]}>
      {/* Hero Cover Section */}
      <View style={styles.heroContainer}>
        {coverImage ? (
          <Image
            source={{ uri: coverImage }}
            style={[styles.cover, { backgroundColor: themeColors.border }]}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.cover, { backgroundColor: themeColors.lightBg }]}>
            <Ionicons name="people-outline" size={36} color={themeColors.textTertiary} />
          </View>
        )}

        {/* Gradient Overlay with Title + Stats */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.heroOverlay}
        >
          <View style={styles.heroContent}>
            {hasLogo ? (
              <Image
                source={{ uri: space.logo ?? undefined }}
                style={styles.heroLogo}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={200}
              />
            ) : hasEmoji ? (
              <View style={styles.heroEmojiAvatar}>
                <Text style={styles.heroEmoji}>{space.settings!.emoji}</Text>
              </View>
            ) : null}
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle} numberOfLines={1}>{space.title}</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStatItem}>
                  <Ionicons name={getPrivacyIcon(space.privacy)} size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.heroStatText}>
                    {space.privacy.charAt(0).toUpperCase() + space.privacy.slice(1)}
                  </Text>
                </View>
                {!hideMemberCount && space.members_count != null && space.members_count > 0 && (
                  <>
                    <View style={styles.heroStatDot} />
                    <View style={styles.heroStatItem}>
                      <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.85)" />
                      <Text style={styles.heroStatText}>
                        {space.members_count} {space.members_count === 1 ? 'Member' : 'Members'}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Badges (top-right) */}
        <View style={styles.heroBadgeRow}>
          {isRoleBadge && (
            <View style={[styles.heroBadge, { backgroundColor: themeColors.primary }]}>
              <Text style={styles.heroBadgeText}>
                {role === 'admin' ? 'Admin' : 'Mod'}
              </Text>
            </View>
          )}
          {isPending ? (
            <View style={[styles.heroBadge, styles.heroBadgeGlass]}>
              <Text style={styles.heroBadgeText}>Awaiting</Text>
            </View>
          ) : isMember ? (
            <View style={[styles.heroBadge, styles.heroBadgeGlass]}>
              <Text style={styles.heroBadgeText}>Joined</Text>
            </View>
          ) : (
            <View style={[styles.heroBadge, styles.heroBadgeGlass, styles.heroBadgeOutlined]}>
              <Text style={styles.heroBadgeText}>
                Join
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Content Below Hero */}
      {space.description && (
        <View style={styles.content}>
          <Text style={[styles.description, { color: themeColors.textSecondary }]} numberOfLines={2}>
            {stripHtmlTags(space.description)}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: sizing.borderRadius.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    ...shadows.md,
  },

  // Hero Section
  heroContainer: {
    aspectRatio: 16 / 9,
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  heroLogo: {
    width: 36,
    height: 36,
    borderRadius: sizing.borderRadius.full,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    marginRight: spacing.sm,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: '#fff',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  heroStatText: {
    fontSize: typography.size.xs,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: typography.weight.medium,
  },
  heroStatDot: {
    width: 3,
    height: 3,
    borderRadius: sizing.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 6,
  },

  // Emoji inline with title
  heroEmojiAvatar: {
    width: 36,
    height: 36,
    borderRadius: sizing.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  heroEmoji: {
    fontSize: typography.size.lg,
  },

  // Hero Badges (top-right overlay)
  heroBadgeRow: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  heroBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: sizing.borderRadius.md,
  },
  heroBadgeGlass: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  heroBadgeOutlined: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  heroBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    color: '#fff',
    textTransform: 'uppercase',
  },

  // Content Below Hero
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  description: {
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
});
