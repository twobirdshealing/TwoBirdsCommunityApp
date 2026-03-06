// =============================================================================
// QUICK POST BOX - Simple composer prompt at top of feed
// =============================================================================
// Shows avatar + placeholder - taps to open full composer
// =============================================================================

import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { shadows, spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface QuickPostBoxProps {
  placeholder?: string;
  onPress: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function QuickPostBox({
  placeholder = "What's happening?",
  onPress,
}: QuickPostBoxProps) {
  const { colors: themeColors } = useTheme();
  const { user } = useAuth();
  const avatar = user?.avatar;

  // AuthContext User type uses displayName (camelCase)
  const displayName = user?.displayName || user?.username || 'User';
  const firstName = displayName.split(' ')[0];

  return (
    <AnimatedPressable
      style={[styles.container, { backgroundColor: themeColors.surface, borderColor: themeColors.border, ...shadows.sm }]}
      onPress={onPress}
    >
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: themeColors.primary }]}>
            <Text style={styles.avatarText}>
              {firstName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Placeholder text */}
      <View style={[styles.inputPlaceholder, { backgroundColor: themeColors.backgroundSecondary }]}>
        <Text style={[styles.placeholderText, { color: themeColors.textSecondary }]}>{placeholder}</Text>
      </View>
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
  },

  avatarContainer: {
    marginRight: spacing.md,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: typography.size.lg,
    fontWeight: '600',
  },

  inputPlaceholder: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },

  placeholderText: {
    fontSize: typography.size.md,
  },
});

export default QuickPostBox;
