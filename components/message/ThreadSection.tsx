// =============================================================================
// THREAD SECTION - Collapsible inbox section header
// =============================================================================
// Used to split the messages inbox into "GROUPS" and "DIRECT MESSAGES" sections.
// Pressing the header toggles its `expanded` state via the controlled callback.
// =============================================================================

import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface ThreadSectionProps {
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: () => void;
}

export function ThreadSection({ title, count, expanded, onToggle }: ThreadSectionProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed ? colors.backgroundSecondary : colors.surface,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.titleGroup}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
        {typeof count === 'number' && (
          <Text style={[styles.count, { color: colors.textTertiary }]}>{count}</Text>
        )}
      </View>
      <Ionicons
        name={expanded ? 'chevron-down' : 'chevron-forward'}
        size={16}
        color={colors.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  title: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  count: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});

export default ThreadSection;
