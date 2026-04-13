// =============================================================================
// COMPLETION CELEBRATION - Bottom sheet shown when a course is 100% complete
// =============================================================================
// FC's API returns `is_completed: true` on the final lesson PUT but ships no
// celebration UI of its own — presentation is up to the consumer. We reuse
// the shared BottomSheet primitive and auto-dismiss after 4s.
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/layout';
import { Button } from '@/components/common/Button';
import { BottomSheet } from '@/components/common/BottomSheet';

interface CompletionCelebrationProps {
  visible: boolean;
  courseTitle: string;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 4000;

export function CompletionCelebration({
  visible,
  courseTitle,
  onDismiss,
}: CompletionCelebrationProps) {
  const { colors } = useTheme();

  // Ref-latest pattern so the timer effect only depends on `visible`.
  // Without this, an inline `onDismiss` from the parent would reset the
  // timer on every parent render and auto-dismiss would never fire.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => onDismissRef.current(), AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [visible]);

  return (
    <BottomSheet visible={visible} onClose={onDismiss} heightPercentage={42}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.successLight }]}>
          <Ionicons name="trophy" size={36} color={colors.success} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Course Complete</Text>

        <Text
          style={[styles.courseTitle, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {courseTitle}
        </Text>

        <Button title="Continue" onPress={onDismiss} style={styles.button} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
  },
  courseTitle: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  button: {
    width: '100%',
  },
});
