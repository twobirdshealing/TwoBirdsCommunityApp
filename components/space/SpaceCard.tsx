// =============================================================================
// SPACE CARD COMPONENT - Unified card for all space displays
// =============================================================================
// Shows: title, description, privacy icon, members count, role badge
// =============================================================================

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

export function SpaceCard({ space, onPress }: SpaceCardProps) {
  const { colors: themeColors, isDark } = useTheme();

  // Privacy icon and label helpers
  const getPrivacyIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (space.privacy) {
      case 'public':
        return 'globe-outline';
      case 'private':
        return 'lock-closed-outline';
      case 'secret':
        return 'eye-off-outline';
      default:
        return 'globe-outline';
    }
  };

  const getPrivacyLabel = (): string => {
    return space.privacy.charAt(0).toUpperCase() + space.privacy.slice(1);
  };

  // Role badge (only for admin/moderator)
  const role = space.pivot?.role;
  const showRoleBadge = role === 'admin' || role === 'moderator';
  const roleBadgeLabel = role === 'admin' ? 'Admin' : 'Mod';

  // Use actual cover photo or fallback
  const hasCoverPhoto = space.cover_photo && space.cover_photo.trim() !== '';

  return (
    <AnimatedPressable onPress={onPress} style={[styles.card, { backgroundColor: themeColors.surface }]}>
      {/* Cover Photo or Gradient Fallback */}
      {hasCoverPhoto ? (
        <Image source={{ uri: space.cover_photo ?? undefined }} style={[styles.cover, { backgroundColor: themeColors.skeleton }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      ) : (
        <LinearGradient
          colors={['#6366f1', '#8b5cf6', '#d946ef']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cover}
        >
          {space.settings?.emoji && (
            <Text style={styles.coverEmoji}>{space.settings.emoji}</Text>
          )}
        </LinearGradient>
      )}

      {/* Logo Overlay (if exists and has cover photo) */}
      {space.logo && hasCoverPhoto && (
        <Image source={{ uri: space.logo }} style={[styles.logo, { borderColor: themeColors.surface, backgroundColor: themeColors.surface }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
      )}

      {/* Emoji Badge (if exists and has cover photo) */}
      {space.settings?.emoji && hasCoverPhoto && (
        <View style={[styles.emojiContainer, { backgroundColor: isDark ? themeColors.backgroundSecondary : 'rgba(255, 255, 255, 0.9)' }]}>
          <Text style={styles.emoji}>{space.settings.emoji}</Text>
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Title Row with Role Badge */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
            {space.title}
          </Text>
          {showRoleBadge && (
            <View style={[styles.roleBadge, { backgroundColor: themeColors.primary }]}>
              <Text style={[styles.roleBadgeText, { color: themeColors.textInverse }]}>{roleBadgeLabel}</Text>
            </View>
          )}
        </View>

        {/* Description */}
        {space.description && (
          <Text style={[styles.description, { color: themeColors.textSecondary }]} numberOfLines={2}>
            {stripHtmlTags(space.description)}
          </Text>
        )}

        {/* Footer: Privacy + Members Count */}
        <View style={styles.footer}>
          <View style={styles.footerItem}>
            <Ionicons name={getPrivacyIcon()} size={14} color={themeColors.textTertiary} />
            <Text style={[styles.privacy, { color: themeColors.textTertiary }]}>
              {getPrivacyLabel()}
            </Text>
          </View>
          {space.members_count != null && space.members_count > 0 && (
            <View style={styles.footerItem}>
              <Ionicons name="people-outline" size={14} color={themeColors.textTertiary} />
              <Text style={[styles.membersCount, { color: themeColors.textTertiary }]}>
                {space.members_count} {space.members_count === 1 ? 'Member' : 'Members'}
              </Text>
            </View>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: sizing.borderRadius.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    ...shadows.md,
  },
  cover: {
    width: '100%',
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverEmoji: {
    fontSize: 48,
  },
  logo: {
    position: 'absolute',
    top: 70,
    left: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: undefined,
    backgroundColor: undefined,
  },
  emojiContainer: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 20,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: sizing.borderRadius.xs,
    marginLeft: spacing.sm,
  },
  roleBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.bold,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  privacy: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  membersCount: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
});
