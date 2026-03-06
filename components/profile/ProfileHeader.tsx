// =============================================================================
// PROFILE HEADER - Modern cover photo, avatar, name, stats
// =============================================================================

import React from 'react';
import { Alert, View, Text, StyleSheet, Pressable, ActivityIndicator, Linking } from 'react-native';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '@/utils/haptics';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Profile } from '@/types/user';
import { Avatar } from '@/components/common/Avatar';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { useSocialProviders, getProviderIcon } from '@/hooks/useSocialProviders';
import { formatCompactNumber } from '@/utils/formatNumber';

interface ProfileHeaderProps {
  profile: Profile;
  isOwnProfile?: boolean;
  isUploading?: boolean;
  onSettingsPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onCoverPhotoPress?: () => void;
  onAvatarPress?: () => void;
}

export function ProfileHeader({
  profile,
  isOwnProfile = false,
  isUploading = false,
  onSettingsPress,
  onFollowersPress,
  onFollowingPress,
  onCoverPhotoPress,
  onAvatarPress,
}: ProfileHeaderProps) {
  const { colors: themeColors, isDark } = useTheme();
  const isVerified = profile.is_verified === 1;
  const coverPhoto = profile.cover_photo || profile.meta?.cover_photo;
  const socialLinks = profile.social_links || profile.meta?.social_links || {};
  const providers = useSocialProviders();
  const activeSocials = providers.filter(p => socialLinks[p.key]);

  const handleOpenSocial = (value: string, baseUrl: string) => {
    // If already a full URL, use as-is; otherwise prepend the platform base URL
    const fullUrl = value.startsWith('http') ? value : `${baseUrl}${value}`;
    Linking.openURL(fullUrl).catch(() => {
      Alert.alert('Unable to open link', 'The link could not be opened.');
    });
  };

  const handleCoverPress = () => {
    if (isOwnProfile && onCoverPhotoPress) {
      hapticLight();
      onCoverPhotoPress();
    }
  };

  const handleAvatarPress = () => {
    if (isOwnProfile && onAvatarPress) {
      hapticLight();
      onAvatarPress();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface }]}>
      {/* Cover Photo */}
      <AnimatedPressable
        style={styles.coverContainer}
        onPress={handleCoverPress}
        disabled={!isOwnProfile}
      >
        {coverPhoto ? (
          <Image
            source={{ uri: coverPhoto }}
            style={styles.coverPhoto}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.coverPhoto, styles.coverPlaceholder, { backgroundColor: themeColors.primary }]} />
        )}

        {/* Subtle gradient overlay */}
        <View style={styles.coverOverlay} />

        {/* Settings Button (own profile only) */}
        {isOwnProfile && onSettingsPress && (
          <Pressable
            style={[styles.settingsButton, { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)' }]}
            onPress={onSettingsPress}
          >
            <Ionicons name="settings-outline" size={20} color={themeColors.icon} />
          </Pressable>
        )}
      </AnimatedPressable>

      {/* Profile Info */}
      <View style={styles.infoContainer}>
        {/* Avatar with edit overlay */}
        <AnimatedPressable
          style={[styles.avatarWrapper, { backgroundColor: themeColors.surface, borderColor: themeColors.surface }]}
          onPress={handleAvatarPress}
          disabled={!isOwnProfile}
        >
          <Avatar
            source={profile.avatar}
            size="xxl"
            fallback={profile.display_name}
          />

          {/* Upload loading overlay */}
          {isUploading && (
            <View style={styles.avatarLoadingOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}
        </AnimatedPressable>

        {/* Name & Badges */}
        <UserDisplayName
          name={profile.display_name}
          verified={isVerified}
          badgeSlugs={profile.badge_slugs || profile.meta?.badge_slug}
          size="xl"
          center
          style={styles.nameRow}
        />
        <Text style={[styles.username, { color: themeColors.textSecondary }]}>@{profile.username}</Text>

        {/* Social Icons */}
        {activeSocials.length > 0 && (
          <View style={styles.socialRow}>
            {activeSocials.map(({ key, domain }) => (
              <Pressable
                key={key}
                onPress={() => handleOpenSocial(socialLinks[key]!, domain)}
                style={styles.socialIconButton}
              >
                <Ionicons name={getProviderIcon(key) as any} size={18} color={themeColors.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}

        {/* Stats Row */}
        <View style={[styles.statsRow, { backgroundColor: themeColors.backgroundSecondary }]}>
          <Pressable style={styles.stat} onPress={onFollowingPress}>
            <Text style={[styles.statValue, { color: themeColors.text }]}>
              {formatCompactNumber(profile.followings_count || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Following</Text>
          </Pressable>

          <View style={[styles.statDivider, { backgroundColor: themeColors.border }]} />

          <Pressable style={styles.stat} onPress={onFollowersPress}>
            <Text style={[styles.statValue, { color: themeColors.text }]}>
              {formatCompactNumber(profile.followers_count || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Followers</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
  },

  // Cover
  coverContainer: {
    height: 200,
    position: 'relative',
  },

  coverPhoto: {
    width: '100%',
    height: '100%',
  },

  coverPlaceholder: {
  },

  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
  },

  settingsButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info
  infoContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },

  avatarWrapper: {
    marginTop: -60,
    padding: 4,
    borderRadius: 64,
    borderWidth: 4,
    position: 'relative',
  },

  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 4,
  },

  nameRow: {
    marginTop: spacing.sm,
  },

  username: {
    fontSize: typography.size.md,
    marginTop: spacing.xs,
  },

  // Social
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },

  socialIconButton: {
    padding: 4,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
  },

  stat: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },

  statValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },

  statLabel: {
    fontSize: typography.size.xs,
    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 30,
  },
});

export default ProfileHeader;
