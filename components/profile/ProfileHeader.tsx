// =============================================================================
// PROFILE HEADER - Modern cover photo, avatar, name, stats
// =============================================================================

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight } from '@/utils/haptics';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Profile } from '@/types';
import { Avatar, ProfileBadge, VerifiedBadge } from '@/components/common';
import { useProfileBadges } from '@/hooks';
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
  const profileBadges = useProfileBadges(profile.badge_slugs || profile.meta?.badge_slug);
  const coverPhoto = profile.cover_photo || profile.meta?.cover_photo;
  const socialLinks = profile.social_links || profile.meta?.social_links || {};

  const socialConfig = [
    { key: 'instagram', icon: 'logo-instagram' as const, baseUrl: 'https://instagram.com/' },
    { key: 'youtube', icon: 'logo-youtube' as const, baseUrl: 'https://youtube.com/' },
    { key: 'fb', icon: 'logo-facebook' as const, baseUrl: 'https://facebook.com/' },
    { key: 'blue_sky', icon: 'cloud-outline' as const, baseUrl: 'https://bsky.app/profile/' },
    { key: 'reddit', icon: 'logo-reddit' as const, baseUrl: 'https://www.reddit.com/user/' },
  ];
  const activeSocials = socialConfig.filter(s => socialLinks[s.key as keyof typeof socialLinks]);

  const handleOpenSocial = (value: string, baseUrl: string) => {
    // If already a full URL, use as-is; otherwise prepend the platform base URL
    const fullUrl = value.startsWith('http') ? value : `${baseUrl}${value}`;
    Linking.openURL(fullUrl).catch(() => {});
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
      <TouchableOpacity
        style={styles.coverContainer}
        onPress={handleCoverPress}
        activeOpacity={isOwnProfile ? 0.85 : 1}
        disabled={!isOwnProfile}
      >
        {coverPhoto ? (
          <Image
            source={{ uri: coverPhoto }}
            style={styles.coverPhoto}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.coverPhoto, styles.coverPlaceholder, { backgroundColor: themeColors.primary }]} />
        )}

        {/* Subtle gradient overlay */}
        <View style={styles.coverOverlay} />

        {/* Settings Button (own profile only) */}
        {isOwnProfile && onSettingsPress && (
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)' }]}
            onPress={onSettingsPress}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={20} color={themeColors.icon} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Profile Info */}
      <View style={styles.infoContainer}>
        {/* Avatar with edit overlay */}
        <TouchableOpacity
          style={[styles.avatarWrapper, { backgroundColor: themeColors.surface, borderColor: themeColors.surface }]}
          onPress={handleAvatarPress}
          activeOpacity={isOwnProfile ? 0.8 : 1}
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
        </TouchableOpacity>

        {/* Name & Badges */}
        <View style={styles.nameRow}>
          <Text style={[styles.displayName, { color: themeColors.text }]}>{profile.display_name}</Text>
          {isVerified && <VerifiedBadge size={20} />}
          {profileBadges.map((badge) => (
            <ProfileBadge key={badge.slug} badge={badge} />
          ))}
        </View>
        <Text style={[styles.username, { color: themeColors.textSecondary }]}>@{profile.username}</Text>

        {/* Social Icons */}
        {activeSocials.length > 0 && (
          <View style={styles.socialRow}>
            {activeSocials.map(({ key, icon, baseUrl }) => (
              <TouchableOpacity
                key={key}
                onPress={() => handleOpenSocial(socialLinks[key as keyof typeof socialLinks]!, baseUrl)}
                activeOpacity={0.7}
                style={styles.socialIconButton}
              >
                <Ionicons name={icon} size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Stats Row */}
        <View style={[styles.statsRow, { backgroundColor: themeColors.backgroundSecondary }]}>
          <TouchableOpacity style={styles.stat} onPress={onFollowingPress}>
            <Text style={[styles.statValue, { color: themeColors.text }]}>
              {formatCompactNumber(profile.followings_count || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Following</Text>
          </TouchableOpacity>

          <View style={[styles.statDivider, { backgroundColor: themeColors.border }]} />

          <TouchableOpacity style={styles.stat} onPress={onFollowersPress}>
            <Text style={[styles.statValue, { color: themeColors.text }]}>
              {formatCompactNumber(profile.followers_count || 0)}
            </Text>
            <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Followers</Text>
          </TouchableOpacity>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },

  displayName: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
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
