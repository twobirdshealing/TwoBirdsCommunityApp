// =============================================================================
// COURSE DETAIL - Course overview with sections, lessons, and progress
// =============================================================================
// Route: /courses/[slug]
// Features:
// - Course hero with cover photo
// - Instructor info (conditional on hide_instructor_view)
// - Enrollment + progress tracking
// - Collapsible sections with lesson rows
// =============================================================================

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stripHtmlTags } from '@/utils/htmlToText';
import { ProgressBar } from '@/components/course/ProgressBar';
import { SectionList } from '@/components/course/SectionList';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { PageHeader } from '@/components/navigation/PageHeader';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useCachedData } from '@/hooks/useCachedData';
import { coursesApi } from '@/services/api/courses';
import { Course, CourseLesson, CourseSection, CourseTrack } from '@/types/course';
import { hapticMedium } from '@/utils/haptics';
import { Button } from '@/components/common/Button';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CourseDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  // Fetch Course Detail
  interface CourseDetailData {
    course: Course;
    sections: CourseSection[];
    track: CourseTrack | null;
  }

  const { data, isLoading: loading, isRefreshing: refreshing, error: fetchError, refresh, mutate } = useCachedData<CourseDetailData>({
    cacheKey: `tbc_course_${slug}`,
    fetcher: async () => {
      const response = await coursesApi.getCourseBySlug(slug);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load course');
      }
      return {
        course: response.data.course,
        sections: response.data.sections,
        track: response.data.track,
      };
    },
  });

  const course = data?.course || null;
  const sections = data?.sections || [];
  const track = data?.track || null;
  const error = fetchError?.message || null;
  const [enrolling, setEnrolling] = useState(false);

  // ---------------------------------------------------------------------------
  // Enroll
  // ---------------------------------------------------------------------------

  const handleEnroll = async () => {
    if (!course) return;
    hapticMedium();
    setEnrolling(true);

    try {
      const response = await coursesApi.enrollInCourse(course.id);

      if (!response.success) {
        Alert.alert('Error', response.error?.message || 'Failed to enroll');
        return;
      }

      // Update local state + refetch to get unlocked lessons
      mutate(prev => prev ? {
        ...prev,
        track: response.data.track,
        course: { ...prev.course, isEnrolled: true, progress: 0 },
      } : prev);
      refresh();
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setEnrolling(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Lesson Press
  // ---------------------------------------------------------------------------

  const handleLessonPress = (lesson: CourseLesson) => {
    if (lesson.is_locked || !lesson.can_view) return;

    router.push({
      pathname: '/courses/[slug]/lesson/[lessonSlug]',
      params: { slug, lessonSlug: lesson.slug },
    });
  };

  // ---------------------------------------------------------------------------
  // Continue Learning — navigate to first incomplete lesson
  // ---------------------------------------------------------------------------

  const handleContinueLearning = () => {
    if (!track || !sections.length) return;
    hapticMedium();

    for (const section of sections) {
      for (const lesson of section.lessons) {
        const isCompleted = track.completed_lessons.some(
          (id) => String(id) === String(lesson.id)
        );
        if (!isCompleted && lesson.can_view && !lesson.is_locked) {
          router.push({
            pathname: '/courses/[slug]/lesson/[lessonSlug]',
            params: { slug, lessonSlug: lesson.slug },
          });
          return;
        }
      }
    }

    // All complete — go to first lesson
    const firstLesson = sections[0]?.lessons[0];
    if (firstLesson) {
      router.push({
        pathname: '/courses/[slug]/lesson/[lessonSlug]',
        params: { slug, lessonSlug: firstLesson.slug },
      });
    }
  };

  // ---------------------------------------------------------------------------
  // Render: Loading / Error
  // ---------------------------------------------------------------------------

  if (loading && !course) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
          <PageHeader leftAction="back" onLeftPress={() => router.back()} title="Course" />
          <LoadingSpinner />
        </View>
      </>
    );
  }

  if (error && !course) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.container, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
          <PageHeader leftAction="back" onLeftPress={() => router.back()} title="Course" />
          <ErrorMessage message={error} onRetry={refresh} />
        </View>
      </>
    );
  }

  if (!course) return null;

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const isEnrolled = track?.isEnrolled ?? course.isEnrolled;
  const progress = track?.progress ?? course.progress ?? 0;
  const completedLessons = track?.completed_lessons ?? [];
  const hideInstructor = course.settings?.hide_instructor_view === 'yes';
  const hasCoverPhoto = course.cover_photo && course.cover_photo.trim() !== ''
    && !course.cover_photo.includes('fluent-community/assets/images/');
  const courseDetails = course.settings?.course_details_rendered;
  const isComplete = progress === 100;

  // Detail endpoint doesn't include counts — compute from sections array
  const sectionsCount = sections.length;
  const lessonsCount = sections.reduce((sum, s) => sum + s.lessons.length, 0);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title={course.title}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={themeColors.primary}
              colors={[themeColors.primary]}
            />
          }
        >
          {/* Hero Section with stats overlay */}
          {hasCoverPhoto ? (
            <View style={styles.heroContainer}>
              <Image source={{ uri: course.cover_photo! }} style={styles.heroCover} contentFit="cover" transition={200} cachePolicy="memory-disk" />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.heroGradient}>
                <Text style={styles.heroTitle}>{course.title}</Text>
                <View style={styles.heroStats}>
                  <View style={styles.heroStatItem}>
                    <Ionicons name="layers-outline" size={14} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroStatText}>{sectionsCount} {sectionsCount === 1 ? 'Section' : 'Sections'}</Text>
                  </View>
                  <Text style={styles.heroStatDot}>&middot;</Text>
                  <View style={styles.heroStatItem}>
                    <Ionicons name="document-text-outline" size={14} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroStatText}>{lessonsCount} {lessonsCount === 1 ? 'Lesson' : 'Lessons'}</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          ) : (
            <View style={styles.heroContainer}>
              <View style={[styles.heroCover, { backgroundColor: themeColors.lightBg, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="book-outline" size={48} color={themeColors.textTertiary} />
              </View>
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.heroGradient}>
                {course.settings?.emoji ? (
                  <Text style={styles.heroEmoji}>{course.settings.emoji}</Text>
                ) : null}
                <Text style={styles.heroTitle}>{course.title}</Text>
                <View style={styles.heroStats}>
                  <View style={styles.heroStatItem}>
                    <Ionicons name="layers-outline" size={14} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroStatText}>{sectionsCount} {sectionsCount === 1 ? 'Section' : 'Sections'}</Text>
                  </View>
                  <Text style={styles.heroStatDot}>&middot;</Text>
                  <View style={styles.heroStatItem}>
                    <Ionicons name="document-text-outline" size={14} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.heroStatText}>{lessonsCount} {lessonsCount === 1 ? 'Lesson' : 'Lessons'}</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* Instructor */}
          {!hideInstructor && course.creator && (
            <AnimatedPressable
              style={[styles.instructorRow, { backgroundColor: themeColors.surface }]}
              onPress={() => course.creator?.username && router.push(`/profile/${course.creator.username}`)}
            >
              {course.creator.avatar ? (
                <Image source={{ uri: course.creator.avatar }} style={styles.instructorAvatar} contentFit="cover" transition={200} cachePolicy="memory-disk" />
              ) : (
                <View style={[styles.instructorAvatar, styles.instructorAvatarPlaceholder, { backgroundColor: themeColors.primary }]}>
                  <Text style={{ color: themeColors.textInverse, fontSize: typography.size.md, fontWeight: typography.weight.semibold }}>
                    {course.creator.display_name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.instructorInfo}>
                <Text style={[styles.instructorLabel, { color: themeColors.textTertiary }]}>Instructor</Text>
                <Text style={[styles.instructorName, { color: themeColors.text }]}>
                  {course.creator.display_name}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
            </AnimatedPressable>
          )}

          {/* Progress + Action Button */}
          <View style={styles.actionSection}>
            {isEnrolled ? (
              <>
                <View style={styles.progressSection}>
                  <ProgressBar progress={progress} height={8} />
                  <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>
                    {isComplete ? 'Course Complete!' : `${Math.round(progress)}% Complete`}
                  </Text>
                </View>
                <Button
                  title={isComplete ? 'Review Course' : 'Continue Learning'}
                  icon={isComplete ? 'refresh-outline' : 'play-outline'}
                  onPress={handleContinueLearning}
                  style={styles.actionButton}
                />
              </>
            ) : (
              <Button
                title="Enroll in Course"
                icon="add-circle-outline"
                onPress={handleEnroll}
                loading={enrolling}
                style={styles.actionButton}
              />
            )}
          </View>

          {/* Course Details (if any) */}
          {courseDetails && courseDetails.trim() !== '' && (
            <View style={[styles.detailsSection, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.sectionHeading, { color: themeColors.text }]}>About This Course</Text>
              <Text style={[styles.detailsText, { color: themeColors.textSecondary }]}>
                {stripHtmlTags(courseDetails).trim()}
              </Text>
            </View>
          )}

          {/* Course Links */}
          {course.settings?.links && course.settings.links.length > 0 && (
            <View style={[styles.linksSection, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.sectionHeading, { color: themeColors.text }]}>Resources</Text>
              {course.settings.links.map((link, i) => (
                <View key={i} style={styles.linkRow}>
                  <Ionicons name="link-outline" size={16} color={themeColors.primary} />
                  <Text style={[styles.linkText, { color: themeColors.primary }]}>{link.title || link.url}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Sections & Lessons */}
          <View style={styles.sectionsContainer}>
            <Text style={[styles.sectionHeading, { color: themeColors.text, paddingHorizontal: spacing.lg }]}>
              Course Content
            </Text>
            {sections.map((section) => (
              <SectionList
                key={section.id}
                section={section}
                completedLessons={completedLessons}
                onLessonPress={handleLessonPress}
                defaultExpanded={sections.length <= 3}
              />
            ))}
          </View>

          {/* Bottom padding */}
          <View style={{ height: spacing.xxl * 2 }} />
        </ScrollView>
      </View>
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  // Hero
  heroContainer: {
    width: '100%',
    height: 200,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },

  heroCover: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },

  heroGradient: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },

  heroTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  heroEmoji: {
    fontSize: sizing.icon.xxl,
    marginBottom: spacing.sm,
  },

  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },

  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  heroStatText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: 'rgba(255,255,255,0.85)',
  },

  heroStatDot: {
    fontSize: typography.size.xs,
    color: 'rgba(255,255,255,0.5)',
    marginHorizontal: 2,
  },

  // Instructor
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },

  instructorAvatar: {
    width: 44,
    height: 44,
    borderRadius: sizing.touchTarget / 2,
  },

  instructorAvatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  instructorInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },

  instructorLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },

  instructorName: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginTop: 2,
  },

  // Action
  actionSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },

  progressSection: {
    marginBottom: spacing.md,
  },

  progressText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    marginTop: spacing.xs,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
    gap: spacing.sm,
  },

  // Details
  detailsSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
  },

  sectionHeading: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing.md,
  },

  detailsText: {
    fontSize: typography.size.md,
    lineHeight: 22,
  },

  // Links
  linksSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.sm,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },

  linkText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },

  // Sections
  sectionsContainer: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
});
