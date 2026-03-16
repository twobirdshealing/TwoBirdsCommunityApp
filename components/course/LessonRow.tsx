// =============================================================================
// LESSON ROW - Single lesson item in a course section
// =============================================================================
// Shows: completion state, title, content type icon, lock state
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { CourseLesson } from '@/types/course';
import { spacing, typography, sizing } from '@/constants/layout';

interface LessonRowProps {
  lesson: CourseLesson;
  index: number;
  isCompleted: boolean;
  isEnrolled?: boolean;
  onPress: () => void;
}

export const LessonRow = React.memo(function LessonRow({ lesson, index, isCompleted, isEnrolled = true, onPress }: LessonRowProps) {
  const { colors: themeColors } = useTheme();
  const isFreePreview = !isEnrolled && lesson.meta?.free_preview_lesson === 'yes';
  const isLocked = (lesson.is_locked || !lesson.can_view) && !isFreePreview;

  return (
    <AnimatedPressable
      style={[styles.container, { borderBottomColor: themeColors.borderLight }]}
      onPress={onPress}
      disabled={isLocked}
      accessibilityRole="button"
      accessibilityLabel={`${lesson.title}${isCompleted ? ', completed' : ''}${isLocked ? ', locked' : ''}`}
    >
      {/* Completion / Lock Indicator */}
      <View style={styles.indicatorContainer}>
        {isLocked ? (
          <View style={[styles.indicator, { backgroundColor: themeColors.borderLight }]}>
            <Ionicons name="lock-closed" size={14} color={themeColors.textTertiary} />
          </View>
        ) : isCompleted ? (
          <View style={[styles.indicator, { backgroundColor: themeColors.success }]}>
            <Ionicons name="checkmark" size={14} color={themeColors.textInverse} />
          </View>
        ) : (
          <View style={[styles.indicator, styles.indicatorEmpty, { borderColor: themeColors.border }]}>
            <Text style={[styles.indexText, { color: themeColors.textTertiary }]}>{index + 1}</Text>
          </View>
        )}
      </View>

      {/* Lesson Info */}
      <View style={styles.info}>
        <Text
          style={[
            styles.title,
            { color: isLocked ? themeColors.textTertiary : themeColors.text },
          ]}
          numberOfLines={2}
        >
          {lesson.title}
        </Text>

        {/* Subtitle row */}
        <View style={styles.subtitleRow}>
          {isFreePreview && (
            <View style={styles.badge}>
              <Ionicons name="eye-outline" size={12} color={themeColors.primary} />
              <Text style={[styles.badgeText, { color: themeColors.primary }]}>Preview</Text>
            </View>
          )}
          {lesson.content_type === 'quiz' && (
            <View style={styles.badge}>
              <Ionicons name="help-circle-outline" size={12} color={themeColors.textTertiary} />
              <Text style={[styles.badgeText, { color: themeColors.textTertiary }]}>Quiz</Text>
            </View>
          )}
          {lesson.meta?.video_length && lesson.meta.video_length > 0 ? (
            <View style={styles.badge}>
              <Ionicons name="play-circle-outline" size={12} color={themeColors.textTertiary} />
              <Text style={[styles.badgeText, { color: themeColors.textTertiary }]}>
                {formatDuration(lesson.meta.video_length)}
              </Text>
            </View>
          ) : null}
          {isLocked && lesson.unclock_date && (
            <View style={styles.badge}>
              <Ionicons name="time-outline" size={12} color={themeColors.textTertiary} />
              <Text style={[styles.badgeText, { color: themeColors.textTertiary }]}>
                Unlocks {formatUnlockDate(lesson.unclock_date)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Chevron */}
      {!isLocked && (
        <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
      )}
    </AnimatedPressable>
  );
});

function formatUnlockDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}:${String(secs).padStart(2, '0')}`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}:${String(remainMins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  indicatorContainer: {
    marginRight: spacing.md,
  },
  indicator: {
    width: 28,
    height: 28,
    borderRadius: sizing.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 2,
  },
  indexText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
    lineHeight: 20,
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  badgeText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
