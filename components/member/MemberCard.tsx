// =============================================================================
// MEMBER CARD - Reusable member display component
// =============================================================================
// Used in:
// - Space Members list
// - Member Directory
// - Followers/Following lists
// - New Message modal
//
// Terminology:
// - admin → "Admin"
// - moderator → "Mod"
// - member → No badge
// =============================================================================

import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Button } from '@/components/common/Button';
import { spacing, sizing, typography } from '@/constants/layout';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { getProviderIcon } from '@/services/api/socialProviders';
import { useSocialProviders } from '@/hooks/useSocialProviders';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface MemberCardData {
  id: number | string;
  user_id?: number | string;
  role?: 'member' | 'moderator' | 'admin' | string;
  status?: 'active' | 'pending' | 'banned' | string;
  // Profile data - can come from xprofile or directly
  xprofile?: {
    user_id?: number;
    display_name?: string;
    username?: string;
    avatar?: string | null;
    short_description?: string | null;
    total_points?: number;
    is_verified?: number | boolean;
    last_activity?: string;
    created_at?: string;
    meta?: {
      badge_slug?: string[];
      social_links?: Record<string, string> | any[];
    };
  };
  // Alternative direct fields (for flexibility)
  display_name?: string;
  username?: string;
  avatar?: string;
  short_description?: string;
  last_activity?: string;
  meta?: {
    badge_slug?: string[];
    social_links?: Record<string, string> | any[];
  };
}

interface MemberCardProps {
  member: MemberCardData;
  onPress?: (member: MemberCardData) => void;
  onMessagePress?: (member: MemberCardData) => void;
  onFollowPress?: (member: MemberCardData) => void;
  isFollowing?: boolean;
  followLoading?: boolean;
  showRole?: boolean;
  showBio?: boolean;
  showLastActive?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------

/**
 * Get display label for role
 */
const getRoleLabel = (role: string): string => {
  switch (role?.toLowerCase()) {
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Mod';
    default:
      return '';
  }
};


/**
 * Format relative time for last activity
 */
const formatLastActive = (dateString: string | undefined): string => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Active now';
    if (diffMins < 60) return `Active ${diffMins}m ago`;
    if (diffHours < 24) return `Active ${diffHours}h ago`;
    if (diffDays < 7) return `Active ${diffDays}d ago`;
    if (diffDays < 30) return `Active ${Math.floor(diffDays / 7)}w ago`;
    
    return `Active ${Math.floor(diffDays / 30)}mo ago`;
  } catch {
    return '';
  }
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const MemberCard = React.memo(function MemberCard({
  member,
  onPress,
  onMessagePress,
  onFollowPress,
  isFollowing = false,
  followLoading = false,
  showRole = true,
  showBio = true,
  showLastActive = true,
  showActions = false,
  compact = false,
}: MemberCardProps) {
  const { colors: themeColors } = useTheme();
  const providers = useSocialProviders();

  // Extract profile data (handle both nested xprofile and direct fields)
  const profile = member.xprofile || {};
  const displayName = profile.display_name || member.display_name || 'Unknown';
  const username = profile.username || member.username || 'unknown';
  const avatar = profile.avatar || member.avatar;
  const bio = profile.short_description || member.short_description;
  const isVerified = profile.is_verified;
  const role = member.role;
  const lastActivity = profile.last_activity || member.last_activity;

  const roleLabel = getRoleLabel(role || '');
  const lastActiveText = formatLastActive(lastActivity);

  // Social links — check both xprofile.meta and direct meta (API returns [] when empty)
  const rawSocial = profile.meta?.social_links || member.meta?.social_links;
  const socialLinks: Record<string, string> = rawSocial && !Array.isArray(rawSocial) ? rawSocial : {};
  const activeSocials = providers.filter(p => socialLinks[p.key]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const content = (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }, compact && styles.containerCompact]}>
      {/* Left: Avatar */}
      <View style={styles.avatarContainer}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" transition={200} cachePolicy="memory-disk" />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: themeColors.primary }]}>
            <Text style={[styles.avatarText, { color: themeColors.textInverse }]}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

      </View>

      {/* Middle: Info */}
      <View style={styles.infoContainer}>
        {/* Name Row */}
        <View style={styles.nameRow}>
          <UserDisplayName
            name={displayName}
            verified={!!isVerified}
            badgeSlugs={profile.meta?.badge_slug || member.meta?.badge_slug}
            numberOfLines={1}
          />
        </View>

        {/* Username + Role Badge */}
        <View style={styles.usernameRow}>
          <Text style={[styles.username, { color: themeColors.textSecondary }]} numberOfLines={1}>
            @{username}
          </Text>
          {showRole && roleLabel ? (
            <View style={[styles.roleBadge, { backgroundColor: themeColors.primary }]}>
              <Text style={[styles.roleBadgeText, { color: themeColors.textInverse }]}>{roleLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Bio (if available and enabled) */}
        {showBio && bio ? (
          <Text style={[styles.bio, { color: themeColors.textSecondary }]} numberOfLines={compact ? 1 : 2}>
            {bio}
          </Text>
        ) : null}

        {/* Last Active */}
        {showLastActive && lastActiveText ? (
          <Text style={[styles.lastActive, { color: themeColors.textTertiary }]}>
            {lastActiveText}
          </Text>
        ) : null}

        {/* Social Icons */}
        {!compact && activeSocials.length > 0 && (
          <View style={styles.socialRow}>
            {activeSocials.map(({ key, domain }) => (
              <Pressable
                key={key}
                onPress={() => {
                  const value = socialLinks[key]!;
                  const url = value.startsWith('http') ? value : `${domain}${value}`;
                  Linking.openURL(url).catch(() => {});
                }}
                style={styles.socialIconButton}
                hitSlop={4}
              >
                <Ionicons name={getProviderIcon(key) as any} size={16} color={themeColors.textSecondary} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {/* Right: Action Buttons (optional) */}
      {showActions && (
        <View style={styles.actionsContainer}>
          {/* Follow Button */}
          {onFollowPress && (
            <Button
              title={isFollowing ? 'Following' : 'Follow'}
              variant={isFollowing ? 'secondary' : 'primary'}
              size="sm"
              onPress={() => { hapticMedium(); onFollowPress(member); }}
              loading={followLoading}
              style={styles.followButton}
            />
          )}

          {/* Message Button */}
          {onMessagePress && (
            <Button
              icon="chatbubble-outline"
              iconOnly
              variant="secondary"
              onPress={() => { hapticLight(); onMessagePress(member); }}
            />
          )}
        </View>
      )}
    </View>
  );

  // Wrap in AnimatedPressable if onPress provided
  if (onPress) {
    return (
      <AnimatedPressable
        onPress={() => onPress(member)}
        accessibilityRole="button"
        accessibilityLabel={`View ${displayName}'s profile`}
      >
        {content}
      </AnimatedPressable>
    );
  }

  return content;
});

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },

  containerCompact: {
    paddingVertical: spacing.sm,
  },

  // Avatar
  avatarContainer: {
    marginRight: spacing.md,
    position: 'relative',
  },

  avatar: {
    width: sizing.avatar.lg,
    height: sizing.avatar.lg,
    borderRadius: sizing.avatar.lg / 2,
  },

  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
  },

  // Info
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },

  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    gap: spacing.sm,
  },

  username: {
    fontSize: typography.size.sm,
  },

  bio: {
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
    lineHeight: Math.round(typography.size.sm * typography.lineHeight.normal),
  },

  lastActive: {
    fontSize: typography.size.xs,
    marginTop: spacing.xs,
  },

  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.md,
  },

  socialIconButton: {
    padding: 2,
  },

  // Role Badge
  roleBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: sizing.borderRadius.full,
  },

  roleBadgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },

  // Actions
  actionsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginLeft: spacing.sm,
    gap: spacing.md,
  },

  followButton: {
    borderRadius: sizing.height.buttonSmall / 2,
  },
});

export default MemberCard;
