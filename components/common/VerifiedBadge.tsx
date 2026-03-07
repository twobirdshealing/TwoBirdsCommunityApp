// =============================================================================
// VERIFIED BADGE - Inline checkmark rendered next to display names
// =============================================================================
// Replaces the Avatar overlay checkmark. Displayed inline: Name ✓ [badges]
// =============================================================================

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { spacing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

interface VerifiedBadgeProps {
  size?: number;
}

export function VerifiedBadge({ size = 16 }: VerifiedBadgeProps) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name="check-decagram"
        size={size}
        color={themeColors.info}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginLeft: spacing.xs,
    justifyContent: 'center',
  },
});
