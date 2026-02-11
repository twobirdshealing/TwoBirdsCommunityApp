// =============================================================================
// MEMBER CARD - Reusable member display component
// =============================================================================
// Used in:
// - Space Members list
// - Member Directory (future)
// - Followers/Following lists (future)
// - Search results (future)
//
// Terminology:
// - admin → "Admin"
// - moderator → "Facilitator" (church terminology)
// - member → No badge
// =============================================================================

import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/layout';

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
    avatar?: string;
    short_description?: string;
    total_points?: number;
    is_verified?: number | boolean;
    last_activity?: string;
    created_at?: string;
  };
  // Alternative direct fields (for flexibility)
  display_name?: string;
  username?: string;
  avatar?: string;
  short_description?: string;
  last_activity?: string;
}

interface MemberCardProps {
  member: MemberCardData;
  onPress?: (member: MemberCardData) => void;
  onMessagePress?: (member: MemberCardData) => void;
  onFollowPress?: (member: MemberCardData) => void;
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
 * Get display label for role (using church terminology)
 */
const getRoleLabel = (role: string): string => {
  switch (role?.toLowerCase()) {
    case 'admin':
      return 'Admin';
    case 'moderator':
      return 'Facilitator';  // Church terminology
    default:
      return '';
  }
};

/**
 * Get badge color for role (themed)
 */
const getRoleBadgeColor = (role: string, tc?: { error: string; info: string; textSecondary: string }): string => {
  switch (role?.toLowerCase()) {
    case 'admin':
      return tc?.error || '#d32f2f';      // Red
    case 'moderator':
      return tc?.info || '#1976d2';       // Blue
    default:
      return tc?.textSecondary || '#757575';  // Gray (won't show for members)
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

export function MemberCard({
  member,
  onPress,
  onMessagePress,
  onFollowPress,
  showRole = true,
  showBio = true,
  showLastActive = true,
  showActions = false,
  compact = false,
}: MemberCardProps) {
  const { colors: themeColors } = useTheme();
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
  const roleBadgeColor = getRoleBadgeColor(role || '', themeColors);
  const lastActiveText = formatLastActive(lastActivity);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const content = (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }, compact && styles.containerCompact]}>
      {/* Left: Avatar */}
      <View style={styles.avatarContainer}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: themeColors.primary }]}>
            <Text style={[styles.avatarText, { color: themeColors.textInverse }]}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}

        {/* Verified Badge */}
        {isVerified ? (
          <View style={[styles.verifiedBadge, { backgroundColor: themeColors.info, borderColor: themeColors.surface }]}>
            <Text style={styles.verifiedIcon}>✓</Text>
          </View>
        ) : null}
      </View>

      {/* Middle: Info */}
      <View style={styles.infoContainer}>
        {/* Name Row */}
        <View style={styles.nameRow}>
          <Text style={[styles.displayName, { color: themeColors.text }]} numberOfLines={1}>
            {displayName}
          </Text>

          {/* Role Badge - inline with name */}
          {showRole && roleLabel ? (
            <View style={[styles.roleBadge, { backgroundColor: roleBadgeColor }]}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          ) : null}
        </View>

        {/* Username */}
        <Text style={[styles.username, { color: themeColors.textSecondary }]} numberOfLines={1}>
          @{username}
        </Text>

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
      </View>

      {/* Right: Action Buttons (optional) */}
      {showActions && (
        <View style={styles.actionsContainer}>
          {/* Message Button */}
          {onMessagePress && (
            <Pressable
              style={[styles.actionButton, { backgroundColor: themeColors.backgroundSecondary }]}
              onPress={() => onMessagePress(member)}
            >
              <Text style={styles.actionIcon}>💬</Text>
            </Pressable>
          )}

          {/* Follow Button */}
          {onFollowPress && (
            <Pressable
              style={[styles.actionButton, styles.followButton, { backgroundColor: themeColors.primary }]}
              onPress={() => onFollowPress(member)}
            >
              <Text style={[styles.followButtonText, { color: themeColors.textInverse }]}>Follow</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );

  // Wrap in Pressable if onPress provided
  if (onPress) {
    return (
      <Pressable
        onPress={() => onPress(member)}
        style={({ pressed }) => pressed && [styles.pressed, { backgroundColor: themeColors.backgroundSecondary }]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },

  containerCompact: {
    paddingVertical: spacing.sm,
  },

  pressed: {
    opacity: 0.7,
  },

  // Avatar
  avatarContainer: {
    marginRight: spacing.md,
    position: 'relative',
  },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },

  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 22,
    fontWeight: '600',
  },

  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },

  verifiedIcon: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
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

  displayName: {
    fontSize: typography.size.md,
    fontWeight: '600',
    marginRight: spacing.xs,
  },

  username: {
    fontSize: typography.size.sm,
    marginBottom: 2,
  },

  bio: {
    fontSize: typography.size.sm,
    marginTop: 4,
    lineHeight: 18,
  },

  lastActive: {
    fontSize: typography.size.xs,
    marginTop: 4,
  },

  // Role Badge
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },

  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },

  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.xs,
  },

  actionIcon: {
    fontSize: 16,
  },

  followButton: {
    width: 'auto',
    paddingHorizontal: spacing.md,
  },

  followButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default MemberCard;
