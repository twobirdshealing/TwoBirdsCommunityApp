// =============================================================================
// PROFILE HEADER - Cover photo, avatar, name, stats
// =============================================================================
// Updated with clickable cover/avatar for editing (Phase 2 ready)
// =============================================================================

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Profile } from '@/types';
import { Avatar } from '@/components/common';
import { formatCompactNumber } from '@/utils/formatNumber';

interface ProfileHeaderProps {
  profile: Profile;
  isOwnProfile?: boolean;
  onSettingsPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onCoverPhotoPress?: () => void;  // For editing cover (Phase 2)
  onAvatarPress?: () => void;      // For editing avatar (Phase 2)
}

export function ProfileHeader({
  profile,
  isOwnProfile = false,
  onSettingsPress,
  onFollowersPress,
  onFollowingPress,
  onCoverPhotoPress,
  onAvatarPress,
}: ProfileHeaderProps) {
  const { colors: themeColors, isDark } = useTheme();
  const isVerified = profile.is_verified === 1;
  const coverPhoto = profile.cover_photo || profile.meta?.cover_photo;

  const handleCoverPress = () => {
    if (isOwnProfile && onCoverPhotoPress) {
      onCoverPhotoPress();
    }
  };

  const handleAvatarPress = () => {
    if (isOwnProfile && onAvatarPress) {
      onAvatarPress();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface }]}>
      {/* Cover Photo */}
      <TouchableOpacity
        style={styles.coverContainer}
        onPress={handleCoverPress}
        activeOpacity={isOwnProfile ? 0.8 : 1}
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

        {/* Edit Cover Hint (own profile only) */}
        {isOwnProfile && onCoverPhotoPress && (
          <View style={styles.editHint}>
            <Text style={styles.editHintText}>📷 Tap to change cover</Text>
          </View>
        )}

        {/* Settings Button (own profile only) */}
        {isOwnProfile && onSettingsPress && (
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: isDark ? themeColors.backgroundSecondary : 'rgba(255,255,255,0.9)' }]}
            onPress={onSettingsPress}
            activeOpacity={0.8}
          >
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Profile Info */}
      <View style={styles.infoContainer}>
        {/* Avatar */}
        <TouchableOpacity
          style={[styles.avatarWrapper, { backgroundColor: themeColors.surface }]}
          onPress={handleAvatarPress}
          activeOpacity={isOwnProfile ? 0.8 : 1}
          disabled={!isOwnProfile}
        >
          <Avatar
            source={profile.avatar}
            size="xxl"
            verified={isVerified}
            fallback={profile.display_name}
          />
          {/* Edit Avatar Hint (own profile only) */}
          {isOwnProfile && onAvatarPress && (
            <View style={[styles.avatarEditBadge, { backgroundColor: themeColors.primary, borderColor: themeColors.surface }]}>
              <Text style={styles.avatarEditIcon}>📷</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Name & Username */}
        <Text style={[styles.displayName, { color: themeColors.text }]}>{profile.display_name}</Text>
        <Text style={[styles.username, { color: themeColors.textSecondary }]}>@{profile.username}</Text>

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

          {profile.total_points > 0 && (
            <>
              <View style={[styles.statDivider, { backgroundColor: themeColors.border }]} />
              <View style={styles.stat}>
                <Text style={[styles.statValue, { color: themeColors.text }]}>
                  {formatCompactNumber(profile.total_points)}
                </Text>
                <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>Points</Text>
              </View>
            </>
          )}
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
    height: 140,
    position: 'relative',
  },

  coverPhoto: {
    width: '100%',
    height: '100%',
  },

  coverPlaceholder: {
  },

  editHint: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -75 }, { translateY: -15 }],
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },

  editHintText: {
    fontSize: typography.size.xs,
  },

  settingsButton: {
    position: 'absolute',
    top: 50,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  settingsIcon: {
    fontSize: 20,
  },

  // Info
  infoContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
  },

  avatarWrapper: {
    marginTop: -50,
    padding: 4,
    borderRadius: 60,
    position: 'relative',
  },

  avatarEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },

  avatarEditIcon: {
    fontSize: 14,
  },

  displayName: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  username: {
    fontSize: typography.size.md,
    marginTop: spacing.xs,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
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
