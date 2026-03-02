// =============================================================================
// EDIT MODE BAR - Top bar shown during widget editing
// =============================================================================
// Displays "Edit Widgets" title with Reset and Done actions.
// =============================================================================

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
      <TouchableOpacity onPress={onReset} activeOpacity={0.7}>
        <Text style={[styles.resetText, { color: themeColors.textSecondary }]}>
          Reset
        </Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: themeColors.text }]}>
        Edit Widgets
      </Text>

      <TouchableOpacity onPress={onDone} activeOpacity={0.7}>
        <Text style={[styles.doneText, { color: themeColors.primary }]}>
          Done
        </Text>
      </TouchableOpacity>
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
    fontWeight: '600',
  },

  resetText: {
    fontSize: typography.size.sm,
    fontWeight: '500',
  },

  doneText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
  },
});

export default EditModeBar;
