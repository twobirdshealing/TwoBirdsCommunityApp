// =============================================================================
// EDIT MODE BAR - Top bar shown during widget editing
// =============================================================================
// Displays "Edit Widgets" title with Reset and Done actions.
// =============================================================================

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface EditModeBarProps {
  onDone: () => void;
  onReset: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function EditModeBar({ onDone, onReset }: EditModeBarProps) {
  const { colors: themeColors } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: themeColors.surface,
          borderBottomColor: themeColors.border,
        },
      ]}
    >
      <Pressable onPress={onReset}>
        <Text style={[styles.resetText, { color: themeColors.textSecondary }]}>
          Reset
        </Text>
      </Pressable>

      <Text style={[styles.title, { color: themeColors.text }]}>
        Edit Widgets
      </Text>

      <Pressable onPress={onDone}>
        <Text style={[styles.doneText, { color: themeColors.primary }]}>
          Done
        </Text>
      </Pressable>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  resetText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  doneText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});

export default EditModeBar;
