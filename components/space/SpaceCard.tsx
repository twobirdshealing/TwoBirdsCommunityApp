// =============================================================================
// SPACE CARD COMPONENT - Unified card for all space displays
// =============================================================================
// Shows: title, description, privacy icon, members count, role badge
// =============================================================================

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { Space } from '@/types';

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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, { backgroundColor: themeColors.surface }, pressed && styles.cardPressed]}>
      {/* Cover Photo or Gradient Fallback */}
      {hasCoverPhoto ? (
        <Image source={{ uri: space.cover_photo ?? undefined }} style={[styles.cover, { backgroundColor: themeColors.skeleton }]} resizeMode="cover" />
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
        <Image source={{ uri: space.logo }} style={[styles.logo, { borderColor: themeColors.surface, backgroundColor: themeColors.surface }]} resizeMode="cover" />
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
            {space.description.replace(/<[^>]*>/g, '')}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
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
    left: 16,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 3,
    borderColor: undefined,
    backgroundColor: undefined,
  },
  emojiContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
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
    padding: 16,
    paddingTop: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 8,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  privacy: {
    fontSize: 13,
    fontWeight: '500',
  },
  membersCount: {
    fontSize: 13,
    fontWeight: '500',
  },
});
