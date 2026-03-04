// =============================================================================
// POLL PREVIEW - Shows attached poll in composer before posting
// =============================================================================
// Mirrors GifPreview pattern — card with summary, edit and remove actions.
// =============================================================================

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import type { PollData } from './PollBuilderSheet';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PollPreviewProps {
  data: PollData;
  onEdit: () => void;
  onRemove: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function PollPreview({ data, onEdit, onRemove }: PollPreviewProps) {
  const { colors } = useTheme();

  const filledOptions = data.options.filter(o => o.trim());
  const typeLabel = data.type === 'multi_choice' ? 'Multiple choice' : 'Single choice';

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.background, borderColor: colors.border }]}
      onPress={onEdit}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
        <Ionicons name="stats-chart" size={22} color={colors.primary} />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          Poll · {filledOptions.length} options
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {typeLabel} · {filledOptions.map(o => o.trim()).join(', ')}
        </Text>
      </View>

      {/* Remove Button */}
      <TouchableOpacity
        style={styles.removeButton}
        onPress={onRemove}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={24} color={colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: sizing.borderRadius.md,
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },

  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: sizing.borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },

  info: {
    flex: 1,
    marginLeft: spacing.md,
  },

  title: {
    fontSize: typography.size.sm,
    fontWeight: '500',
    marginBottom: 2,
  },

  subtitle: {
    fontSize: typography.size.xs,
  },

  removeButton: {
    padding: spacing.xs,
  },
});

export default PollPreview;
