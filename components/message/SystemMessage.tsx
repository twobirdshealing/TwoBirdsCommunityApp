// =============================================================================
// SYSTEM MESSAGE - Centered divider for group system events
// =============================================================================
// Renders messages with `meta.system_event === true` as a centered tag with
// horizontal-line dividers on either side. Used for "Two Birds created the
// group", "X was added", "Y left the group", etc.
// =============================================================================

import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface SystemMessageProps {
  text: string;
}

export function SystemMessage({ text }: SystemMessageProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
      <Text style={[styles.text, { color: colors.textSecondary }]} numberOfLines={2}>
        {text}
      </Text>
      <View style={[styles.line, { backgroundColor: colors.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },

  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },

  text: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
    flexShrink: 1,
    maxWidth: '70%',
  },
});

export default SystemMessage;
