// =============================================================================
// USER DISPLAY NAME - Shared inline name + verified badge + profile badges
// =============================================================================
// Renders: Name ✓ [badge] [badge] — consistent across all screens.
// Replaces duplicated name+badge JSX in FeedCard, CommentSheet, MemberCard,
// ConversationCard, ProfileHeader, BlogCard, BlogCommentSheet, etc.
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { ProfileBadge } from '@/components/common/ProfileBadge';
import { useProfileBadges } from '@/hooks/useBadgeDefinitions';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Size presets — maps to text size + verified badge size
// -----------------------------------------------------------------------------

const SIZE_MAP = {
  sm: { fontSize: typography.size.sm, badgeSize: 14 },
  md: { fontSize: typography.size.md, badgeSize: 16 },
  lg: { fontSize: typography.size.xl, badgeSize: 18 },
  xl: { fontSize: typography.size.xxl, badgeSize: 20 },
} as const;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UserDisplayNameProps {
  name: string;
  verified?: boolean;
  badgeSlugs?: string[];
  size?: 'sm' | 'md' | 'lg' | 'xl';
  bold?: boolean;
  center?: boolean;
  numberOfLines?: number;
  nameColor?: string;
  style?: ViewStyle;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function UserDisplayName({
  name,
  verified = false,
  badgeSlugs,
  size = 'md',
  bold = true,
  center = false,
  numberOfLines,
  nameColor,
  style,
}: UserDisplayNameProps) {
  const { colors: themeColors } = useTheme();
  const profileBadges = useProfileBadges(badgeSlugs);
  const { fontSize, badgeSize } = SIZE_MAP[size];

  const containerStyle: ViewStyle[] = [styles.container];
  if (center) containerStyle.push(styles.centered);
  if (style) containerStyle.push(style);

  return (
    <View style={containerStyle}>
      <Text
        style={[
          styles.name,
          {
            fontSize,
            fontWeight: bold ? '600' : '400',
            color: nameColor || themeColors.text,
          },
          numberOfLines != null && styles.nameShrink,
        ]}
        numberOfLines={numberOfLines}
      >
        {name}
      </Text>
      {verified && <VerifiedBadge size={badgeSize} />}
      {profileBadges.map((badge) => (
        <ProfileBadge key={badge.slug} badge={badge} />
      ))}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },

  centered: {
    justifyContent: 'center',
  },

  name: {
    // fontSize, fontWeight, color set inline
  },

  nameShrink: {
    flexShrink: 1,
  },
});
