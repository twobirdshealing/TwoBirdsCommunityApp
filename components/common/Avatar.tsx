// =============================================================================
// AVATAR - Reusable user avatar component
// =============================================================================
// Displays a user's profile picture with optional verified badge and online status.
//
// Usage:
//   <Avatar source={user.avatar} size="md" />
//   <Avatar source={user.avatar} size="lg" verified online />
// =============================================================================

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/colors';
import { sizing } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface AvatarProps {
  // Image URL (can be null/undefined - will show placeholder)
  source?: string | null;
  
  // Size preset
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
  
  // Show verified badge
  verified?: boolean;
  
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

// Badge size relative to avatar
const badgeSizeMap = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Avatar({ 
  source, 
  size = 'md', 
  verified = false, 
  online = false,
  fallback = '?',
}: AvatarProps) {
  const avatarSize = sizeMap[size];
  const badgeSize = badgeSizeMap[size];
  
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
          style={[styles.image, containerStyle]}
        />
      ) : (
        <View style={[styles.placeholder, containerStyle]}>
          <Text style={[styles.placeholderText, { fontSize: avatarSize * 0.4 }]}>
            {fallback.substring(0, 2).toUpperCase()}
          </Text>
        </View>
      )}
      
      {/* Verified Badge */}
      {verified && (
        <View style={[
          styles.verifiedBadge, 
          { 
            width: badgeSize, 
            height: badgeSize, 
            borderRadius: badgeSize / 2,
            right: -2,
            bottom: -2,
          }
        ]}>
          <Text style={[styles.verifiedIcon, { fontSize: badgeSize * 0.6 }]}>✓</Text>
        </View>
      )}
      
      {/* Online Indicator */}
      {online && !verified && (
        <View style={[
          styles.onlineIndicator, 
          { 
            width: badgeSize * 0.7, 
            height: badgeSize * 0.7, 
            borderRadius: badgeSize / 2,
            right: 0,
            bottom: 0,
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
    backgroundColor: colors.skeleton,
  },
  
  placeholder: {
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  placeholderText: {
    color: colors.textInverse,
    fontWeight: '600',
  },
  
  verifiedBadge: {
    position: 'absolute',
    backgroundColor: colors.verified,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  
  verifiedIcon: {
    color: colors.textInverse,
    fontWeight: 'bold',
  },
  
  onlineIndicator: {
    position: 'absolute',
    backgroundColor: colors.online,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});

export default Avatar;
