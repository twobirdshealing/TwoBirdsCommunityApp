// =============================================================================
// PROGRESS BAR - Themed progress indicator for courses
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';

interface ProgressBarProps {
  progress: number; // 0-100
  height?: number;
  showLabel?: boolean;
}

export function ProgressBar({ progress, height = 6, showLabel = false }: ProgressBarProps) {
  const { colors: themeColors } = useTheme();
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <View style={styles.container}>
      <View style={[styles.track, { height, backgroundColor: withOpacity(themeColors.primary, 0.15) }]}>
        <View
          style={[
            styles.fill,
            {
              height,
              width: `${clampedProgress}%`,
              backgroundColor: clampedProgress === 100 ? themeColors.success : themeColors.primary,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: themeColors.textSecondary }]}>
          {Math.round(clampedProgress)}% Complete
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  track: {
    borderRadius: sizing.borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: sizing.borderRadius.full,
  },
  label: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    marginTop: spacing.xs,
  },
});
