// =============================================================================
// COURSE CARD - Card component for course lists
// =============================================================================
// Shows: cover photo, title, metadata (sections, lessons, students), progress
// =============================================================================

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { Course } from '@/types/course';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { ProgressBar } from './ProgressBar';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { stripHtmlTags } from '@/utils/htmlToText';

interface CourseCardProps {
  course: Course;
  onPress: () => void;
}

export function CourseCard({ course, onPress }: CourseCardProps) {
  const { colors: themeColors, isDark } = useTheme();

  const hasCoverPhoto = course.cover_photo && course.cover_photo.trim() !== '';
  const hideStudentCount = course.settings?.hide_members_count === 'yes';
  const isEnrolled = course.isEnrolled;
  const progress = course.progress ?? 0;

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: themeColors.surface }]}
    >
      {/* Cover Photo or Gradient Fallback */}
      {hasCoverPhoto ? (
        <View style={styles.coverContainer}>
          <Image source={{ uri: course.cover_photo! }} style={[styles.cover, { backgroundColor: themeColors.skeleton }]} contentFit="cover" transition={200} cachePolicy="memory-disk" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)']}
            style={styles.coverGradient}
          />
        </View>
      ) : (
        <LinearGradient
          colors={['#6366f1', '#8b5cf6', '#d946ef']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cover}
        >
          {course.settings?.emoji ? (
            <Text style={styles.coverEmoji}>{course.settings.emoji}</Text>
          ) : null}
        </LinearGradient>
      )}

      {/* Emoji Badge */}
      {course.settings?.emoji && hasCoverPhoto ? (
        <View style={[styles.emojiBadge, { backgroundColor: isDark ? themeColors.backgroundSecondary : 'rgba(255, 255, 255, 0.9)' }]}>
          <Text style={styles.emojiBadgeText}>{course.settings.emoji}</Text>
        </View>
      ) : null}

      {/* Privacy Badge (for private/secret courses) */}
      {course.privacy !== 'public' && (
        <View style={[styles.privacyBadge, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <Ionicons name="lock-closed" size={12} color="#fff" />
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>
          {course.title}
        </Text>

        {/* Metadata Row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="layers-outline" size={14} color={themeColors.textTertiary} />
            <Text style={[styles.metaText, { color: themeColors.textTertiary }]}>
              {course.sectionsCount} {course.sectionsCount === 1 ? 'Section' : 'Sections'}
            </Text>
          </View>
          <View style={[styles.metaDot, { backgroundColor: themeColors.textTertiary }]} />
          <View style={styles.metaItem}>
            <Ionicons name="document-text-outline" size={14} color={themeColors.textTertiary} />
            <Text style={[styles.metaText, { color: themeColors.textTertiary }]}>
              {course.lessonsCount} {course.lessonsCount === 1 ? 'Lesson' : 'Lessons'}
            </Text>
          </View>
          {!hideStudentCount && course.studentsCount > 0 && (
            <>
              <View style={[styles.metaDot, { backgroundColor: themeColors.textTertiary }]} />
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={14} color={themeColors.textTertiary} />
                <Text style={[styles.metaText, { color: themeColors.textTertiary }]}>
                  {course.studentsCount} {course.studentsCount === 1 ? 'student' : 'students'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Description */}
        {course.description ? (
          <Text style={[styles.description, { color: themeColors.textSecondary }]} numberOfLines={2}>
            {stripHtmlTags(course.description)}
          </Text>
        ) : null}

        {/* Progress Bar (enrolled courses) */}
        {isEnrolled && (
          <View style={styles.progressContainer}>
            <ProgressBar progress={progress} showLabel />
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: sizing.borderRadius.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    ...shadows.md,
  },
  coverContainer: {
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  coverEmoji: {
    fontSize: 48,
  },
  emojiBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiBadgeText: {
    fontSize: 18,
  },
  privacyBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    marginHorizontal: spacing.sm,
  },
  metaText: {
    fontSize: typography.size.sm,
    fontWeight: '500',
  },
  description: {
    fontSize: typography.size.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  progressContainer: {
    marginTop: spacing.xs,
  },
});
