// =============================================================================
// PROFILE HEADER - Cover photo, avatar, name, stats
// =============================================================================
// Updated with clickable cover/avatar for editing (Phase 2 ready)
// =============================================================================

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
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
    <View style={styles.container}>
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
          <View style={[styles.coverPhoto, styles.coverPlaceholder]} />
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
            style={styles.settingsButton} 
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
          style={styles.avatarWrapper}
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
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>📷</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Name & Username */}
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.username}>@{profile.username}</Text>

        {/* Bio */}
        {profile.short_description && (
          <Text style={styles.bio}>{profile.short_description}</Text>
        )}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity style={styles.stat} onPress={onFollowingPress}>
            <Text style={styles.statValue}>
              {formatCompactNumber(profile.followings_count || 0)}
            </Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>

          <View style={styles.statDivider} />

          <TouchableOpacity style={styles.stat} onPress={onFollowersPress}>
            <Text style={styles.statValue}>
              {formatCompactNumber(profile.followers_count || 0)}
            </Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>

          {profile.total_points > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {formatCompactNumber(profile.total_points)}
                </Text>
                <Text style={styles.statLabel}>Points</Text>
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
    backgroundColor: colors.surface,
  },

  // Cover
  coverContainer: {
    height: 140,
    position: 'relative',
  },

  coverPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.skeleton,
  },

  coverPlaceholder: {
    backgroundColor: colors.primary,
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
    color: colors.textInverse,
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },

  avatarEditIcon: {
    fontSize: 14,
  },

  displayName: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.text,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  username: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  bio: {
    fontSize: typography.size.md,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    lineHeight: typography.size.md * 1.5,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
  },

  stat: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },

  statValue: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },

  statLabel: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border,
  },
});

export default ProfileHeader;
