// =============================================================================
// PROFILE BADGE - Small pill rendered inline next to display names
// =============================================================================
// Shows emoji/logo + label based on badge definition from server.
// Matches Fluent Community web portal badge rendering.
// Two modes: pill (icon + label) or icon-only (no background, larger icon)
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/contexts/ThemeContext';
import { typography, sizing } from '@/constants/layout';
import type { Badge } from '@/types/user';

interface ProfileBadgeProps {
  badge: Badge;
}

export function ProfileBadge({ badge }: ProfileBadgeProps) {
  const { colors: themeColors } = useTheme();

  const showLabel = badge.show_label !== 'no';
  const hasEmoji = !!badge.config?.emoji;
  const hasLogo = !!badge.config?.logo;

  // Icon-only mode — no pill, no label, larger icon with border
  if (!showLabel) {
    return (
      <View style={styles.iconOnly}>
        {hasLogo && (
          <Image
            source={{ uri: badge.config!.logo }}
            style={[styles.logoLarge, { borderColor: themeColors.border }]}
          />
        )}
        {hasEmoji && (
          <Text style={styles.emojiLarge}>{badge.config!.emoji}</Text>
        )}
      </View>
    );
  }

  // Pill mode — colored background + icon + label text
  const bgColor = badge.background_color || themeColors.lightBg;
  const textColor = badge.color || themeColors.text;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }]}>
      {hasLogo && (
        <Image source={{ uri: badge.config!.logo }} style={styles.logo} />
      )}
      {hasEmoji && (
        <Text style={styles.emoji}>{badge.config!.emoji}</Text>
      )}
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>
        {badge.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  // Icon-only mode — no background, just spacing
  iconOnly: {
    marginLeft: 6,
    justifyContent: 'center',
  },

  logoLarge: {
    width: 18,
    height: 18,
    borderRadius: sizing.borderRadius.full,
    borderWidth: 1.5,
  },

  emojiLarge: {
    fontSize: typography.size.md,
  },

  // Pill mode — colored background with icon + label
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: sizing.borderRadius.full,
    marginLeft: 6,
  },

  logo: {
    width: 14,
    height: 14,
    borderRadius: sizing.borderRadius.full,
    marginRight: 3,
  },

  emoji: {
    fontSize: typography.size.xs,
    marginRight: 2,
  },

  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
});
