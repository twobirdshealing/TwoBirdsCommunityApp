// =============================================================================
// COURSE CARD - Hero-style card for course displays
// =============================================================================
// Cover image with gradient overlay, title + emoji + stats on hero.
// Description and progress bar below the hero.
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

export const CourseCard = React.memo(function CourseCard({ course, onPress }: CourseCardProps) {
  const { colors: themeColors } = useTheme();

  const hasCoverPhoto = course.cover_photo && course.cover_photo.trim() !== ''
    && !course.cover_photo.includes('fluent-community/assets/images/');
  const hasEmoji = course.settings?.emoji && course.settings.emoji.trim() !== '';
  const hideStudentCount = course.settings?.hide_members_count === 'yes';
  const isEnrolled = course.isEnrolled;
  const progress = course.progress ?? 0;

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: themeColors.surface }]}
    >
      {/* Hero Cover Section */}
      <View style={styles.heroContainer}>
        {hasCoverPhoto ? (
          <Image
            source={{ uri: course.cover_photo! }}
            style={[styles.cover, { backgroundColor: themeColors.border }]}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.cover, { backgroundColor: themeColors.lightBg }]}>
            <Ionicons name="book-outline" size={36} color={themeColors.textTertiary} />
          </View>
        )}

        {/* Gradient Overlay with Title + Stats */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.7)']}
          style={styles.heroOverlay}
        >
          <View style={styles.heroContent}>
            {hasEmoji ? (
              <View style={styles.heroEmojiAvatar}>
                <Text style={styles.heroEmoji}>{course.settings!.emoji}</Text>
              </View>
            ) : null}
            <View style={styles.heroTextContainer}>
              <Text style={styles.heroTitle} numberOfLines={1}>{course.title}</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStatItem}>
                  <Ionicons name="layers-outline" size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.heroStatText}>
                    {course.sectionsCount} {course.sectionsCount === 1 ? 'Section' : 'Sections'}
                  </Text>
                </View>
                <View style={styles.heroStatDot} />
                <View style={styles.heroStatItem}>
                  <Ionicons name="document-text-outline" size={13} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.heroStatText}>
                    {course.lessonsCount} {course.lessonsCount === 1 ? 'Lesson' : 'Lessons'}
                  </Text>
                </View>
                {!hideStudentCount && course.studentsCount > 0 && (
                  <>
                    <View style={styles.heroStatDot} />
                    <View style={styles.heroStatItem}>
                      <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.85)" />
                      <Text style={styles.heroStatText}>
                        {course.studentsCount} {course.studentsCount === 1 ? 'Student' : 'Students'}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Privacy Badge (top-right) */}
        {course.privacy !== 'public' && (
          <View style={styles.heroBadgeRow}>
            <View style={[styles.heroBadge, styles.heroBadgeGlass]}>
              <Ionicons name="lock-closed" size={10} color="#fff" />
            </View>
          </View>
        )}
      </View>

      {/* Content Below Hero */}
      {(course.description || isEnrolled) && (
        <View style={styles.content}>
          {course.description ? (
            <Text style={[styles.description, { color: themeColors.textSecondary }]} numberOfLines={2}>
              {stripHtmlTags(course.description)}
            </Text>
          ) : null}
          {isEnrolled && (
            <View style={styles.progressRow}>
              <Text style={[styles.progressText, { color: themeColors.textTertiary }]}>
                {progress === 100 ? 'Complete' : `${Math.round(progress)}%`}
              </Text>
              <View style={{ flex: 1 }}>
                <ProgressBar progress={progress} />
              </View>
            </View>
          )}
        </View>
      )}
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: sizing.borderRadius.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    overflow: 'hidden',
    ...shadows.md,
  },

  // Hero Section
  heroContainer: {
    aspectRatio: 16 / 9,
    position: 'relative',
  },
  cover: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: '#fff',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  heroStatText: {
    fontSize: typography.size.xs,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: typography.weight.medium,
  },
  heroStatDot: {
    width: 3,
    height: 3,
    borderRadius: sizing.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 6,
  },

  // Emoji inline with title
  heroEmojiAvatar: {
    width: 36,
    height: 36,
    borderRadius: sizing.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  heroEmoji: {
    fontSize: typography.size.lg,
  },

  // Hero Badges (top-right overlay)
  heroBadgeRow: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  heroBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: sizing.borderRadius.md,
  },
  heroBadgeGlass: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // Content Below Hero
  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  description: {
    fontSize: typography.size.sm,
    lineHeight: 20,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  progressText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});
