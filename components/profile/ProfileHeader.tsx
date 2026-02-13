// =============================================================================
// PROFILE HEADER - Modern cover photo, avatar, name, stats
// =============================================================================

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Profile } from '@/types';
import { Avatar } from '@/components/common';
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

        {/* Subtle gradient overlay */}
        <View style={styles.coverOverlay} />

        {/* Edit Cover Button (own profile only) */}
        {isOwnProfile && onCoverPhotoPress && (
          <TouchableOpacity
            style={styles.coverEditButton}
            onPress={handleCoverPress}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={16} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Settings Button (own profile only) */}
        {isOwnProfile && onSettingsPress && (
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.85)' }]}
            onPress={onSettingsPress}
            activeOpacity={0.8}
          >
            <Ionicons name="settings-outline" size={20} color={isDark ? '#fff' : '#333'} />
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
            verified={isVerified}
            fallback={profile.display_name}
          />

          {/* Upload loading overlay */}
          {isUploading && (
            <View style={styles.avatarLoadingOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          )}

          {/* Edit Avatar Button (own profile only) */}
          {isOwnProfile && onAvatarPress && !isUploading && (
            <View style={[styles.avatarEditBadge, { backgroundColor: themeColors.primary, borderColor: themeColors.surface }]}>
              <Ionicons name="camera" size={14} color="#fff" />
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

  coverEditButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
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

  avatarEditBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
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
