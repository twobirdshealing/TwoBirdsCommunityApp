// =============================================================================
// HEADER ICON BUTTON - Reusable icon button with optional badge
// =============================================================================
// Used in TopHeader for Messages, Notifications, etc.
// =============================================================================

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface HeaderIconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  badgeCount?: number;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function HeaderIconButton({
  icon,
  onPress,
  badgeCount = 0,
  size = 24,
  color,
  accessibilityLabel,
}: HeaderIconButtonProps) {
  const { colors: themeColors } = useTheme();
  const iconColor = color || themeColors.text;
  const showBadge = badgeCount > 0;
  const displayCount = badgeCount > 99 ? '99+' : badgeCount.toString();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && [styles.pressed, { backgroundColor: themeColors.backgroundSecondary }],
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Ionicons name={icon} size={size} color={iconColor} />
      
      {showBadge && (
        <View style={[styles.badge, { backgroundColor: themeColors.error, borderColor: themeColors.surface }]}>
          <Text style={[styles.badgeText, { color: '#fff' }]}>{displayCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },

  pressed: {
    opacity: 0.7,
  },

  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 1.5,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
});

export default HeaderIconButton;
