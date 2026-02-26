// =============================================================================
// AVATAR - Reusable user avatar component
// =============================================================================
// Displays a user's profile picture with optional online status indicator.
// Verification checkmark is now rendered inline next to display names
// using the VerifiedBadge component instead.
//
// Usage:
//   <Avatar source={user.avatar} size="md" />
//   <Avatar source={user.avatar} size="lg" online />
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface AvatarProps {
  // Image URL (can be null/undefined - will show placeholder)
  source?: string | null;

  // Size preset
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

  // Show online indicator
  online?: boolean;

  // Fallback text (usually initials) if no image
  fallback?: string;
}

// -----------------------------------------------------------------------------
// Size Mapping
// -----------------------------------------------------------------------------

const sizeMap = {
  xs: sizing.avatar.xs,   // 24
  sm: sizing.avatar.sm,   // 32
  md: sizing.avatar.md,   // 40
  lg: sizing.avatar.lg,   // 56
  xl: sizing.avatar.xl,   // 80
  xxl: sizing.avatar.xxl, // 120
};

// Online indicator size relative to avatar
const indicatorSizeMap = {
  xs: 7,
  sm: 8,
  md: 10,
  lg: 13,
  xl: 15,
  xxl: 20,
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Avatar({
  source,
  size = 'md',
  online = false,
  fallback = '?',
}: AvatarProps) {
  const { colors: themeColors } = useTheme();
  const avatarSize = sizeMap[size];
  const indicatorSize = indicatorSizeMap[size];

  // Dynamic styles based on size
  const containerStyle = {
    width: avatarSize,
    height: avatarSize,
    borderRadius: avatarSize / 2,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* Avatar Image or Placeholder */}
      {source ? (
        <Image
          source={{ uri: source }}
          style={[styles.image, containerStyle, { backgroundColor: themeColors.skeleton }]}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.placeholder, containerStyle, { backgroundColor: themeColors.primary }]}>
          <Text style={[styles.placeholderText, { fontSize: avatarSize * 0.4 }]}>
            {fallback.substring(0, 2).toUpperCase()}
          </Text>
        </View>
      )}

      {/* Online Indicator */}
      {online && (
        <View style={[
          styles.onlineIndicator,
          {
            width: indicatorSize,
            height: indicatorSize,
            borderRadius: indicatorSize / 2,
            right: 0,
            bottom: 0,
            borderColor: themeColors.surface,
            backgroundColor: themeColors.online,
          }
        ]} />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },

  image: {
  },

  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  placeholderText: {
    fontWeight: '600',
  },

  onlineIndicator: {
    position: 'absolute',
    borderWidth: 2,
  },
});

export default Avatar;
