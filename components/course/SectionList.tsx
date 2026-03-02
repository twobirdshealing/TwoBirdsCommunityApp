// =============================================================================
// SECTION LIST - Collapsible course section with lesson rows
// =============================================================================
// Shows: section header with collapse toggle, list of LessonRow items
// =============================================================================

import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { CourseLesson, CourseSection } from '@/types/course';
import { spacing, typography } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { LessonRow } from './LessonRow';

interface SectionListProps {
  section: CourseSection;
  completedLessons: (string | number)[];
  onLessonPress: (lesson: CourseLesson) => void;
  defaultExpanded?: boolean;
}

export function SectionList({
  section,
  completedLessons,
  onLessonPress,
  defaultExpanded = true,
}: SectionListProps) {
  const { colors: themeColors } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const completedCount = section.lessons.filter((l) =>
    completedLessons.some((id) => String(id) === String(l.id))
  ).length;
  const totalCount = section.lessons.length;

  return (
    <View style={[styles.container, { borderColor: themeColors.borderLight }]}>
      {/* Section Header */}
      <TouchableOpacity
        style={[styles.header, { backgroundColor: withOpacity(themeColors.background, 0.5) }]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`${section.title}, ${expanded ? 'collapse' : 'expand'}`}
      >
        <View style={styles.headerLeft}>
          {section.is_locked && (
            <Ionicons name="lock-closed" size={16} color={themeColors.textTertiary} style={styles.lockIcon} />
          )}
          <View style={styles.headerText}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]} numberOfLines={1}>
              {section.title}
            </Text>
            <Text style={[styles.sectionMeta, { color: themeColors.textTertiary }]}>
              {completedCount}/{totalCount} lessons
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={themeColors.textTertiary}
        />
      </TouchableOpacity>

      {/* Lessons */}
      {expanded && (
        <View>
          {section.lessons.map((lesson, index) => {
            const isCompleted = completedLessons.some(
              (id) => String(id) === String(lesson.id)
            );

            return (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                index={index}
                isCompleted={isCompleted}
                onPress={() => onLessonPress(lesson)}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  lockIcon: {
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },
  sectionMeta: {
    fontSize: typography.size.xs,
    marginTop: 2,
  },
});
