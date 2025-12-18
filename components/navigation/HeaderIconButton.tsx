// =============================================================================
// HEADER ICON BUTTON - Reusable icon button with optional badge
// =============================================================================
// Used in TopHeader for Messages, Notifications, etc.
// =============================================================================

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';

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
  color = colors.text,
}: HeaderIconButtonProps) {
  const showBadge = badgeCount > 0;
  const displayCount = badgeCount > 99 ? '99+' : badgeCount.toString();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={size} color={color} />
      
      {showBadge && (
        <View style={styles.badge}>
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
    backgroundColor: colors.backgroundSecondary,
  },

  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },

  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});

export default HeaderIconButton;
