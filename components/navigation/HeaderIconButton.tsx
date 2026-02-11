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
    >
      <Ionicons name={icon} size={size} color={iconColor} />
      
      {showBadge && (
        <View style={[styles.badge, { backgroundColor: themeColors.error, borderColor: themeColors.surface }]}>
          <Text style={styles.badgeText}>{displayCount}</Text>
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
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});

export default HeaderIconButton;
