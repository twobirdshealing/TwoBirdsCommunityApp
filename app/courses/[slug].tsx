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
  Linking,
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
import { Avatar } from '@/components/common/Avatar';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { ProgressBar } from '@/components/course/ProgressBar';
import { SectionList } from '@/components/course/SectionList';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { PageHeader, HeaderTitle } from '@/components/navigation/PageHeader';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppQuery } from '@/hooks/useAppQuery';
import { coursesApi } from '@/services/api/courses';
import { Course, CourseLesson, CourseSection, CourseTrack } from '@/types/course';
import { hapticMedium } from '@/utils/haptics';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Button } from '@/components/common/Button';
import { CourseLockScreen } from '@/components/course/CourseLockScreen';

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

  const { data, isLoading: loading, isRefreshing: refreshing, error: fetchError, refresh, mutate } = useAppQuery<CourseDetailData>({
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
  const [requesting, setRequesting] = useState(false);
  const [isPending, setIsPending] = useState(false);

  // ---------------------------------------------------------------------------
  // Request Access (private courses)
  // ---------------------------------------------------------------------------

  const handleRequestAccess = async () => {
    if (!course) return;
    hapticMedium();
    setRequesting(true);

    try {
      const response = await coursesApi.requestCourseAccess(course.id);

      if (!response.success) {
        Alert.alert('Error', response.error?.message || 'Failed to send request');
        return;
      }

      setIsPending(true);
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

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
    const isFreePreview = !isEnrolled && lesson.meta?.free_preview_lesson === 'yes';
    if ((lesson.is_locked || !lesson.can_view) && !isFreePreview) return;

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
          <PageHeader left={<HeaderIconButton icon="chevron-back" onPress={() => router.back()} />} center={<HeaderTitle>Course</HeaderTitle>} />
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
          <PageHeader left={<HeaderIconButton icon="chevron-back" onPress={() => router.back()} />} center={<HeaderTitle>Course</HeaderTitle>} />
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
          left={<HeaderIconButton icon="chevron-back" onPress={() => router.back()} />}
          center={<HeaderTitle>{course.title}</HeaderTitle>}
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
              <Avatar
                source={course.creator.avatar}
                size="lg"
                fallback={course.creator.display_name?.charAt(0) || '?'}
              />
              <View style={styles.instructorInfo}>
                <Text style={[styles.instructorLabel, { color: themeColors.textTertiary }]}>Instructor</Text>
                <UserDisplayName
                  name={course.creator.display_name}
                  verified={!!course.creator.is_verified}
                  size="md"
                  numberOfLines={1}
                />
                {course.creator.short_description ? (
                  <Text style={[styles.instructorBio, { color: themeColors.textSecondary }]} numberOfLines={2}>
                    {course.creator.short_description}
                  </Text>
                ) : null}
                {(course.creator.total_courses || (course.settings?.show_instructor_students_count === 'yes' && course.creator.total_students)) ? (
                  <View style={styles.instructorStats}>
                    {course.creator.total_courses ? (
                      <Text style={[styles.instructorStatText, { color: themeColors.textTertiary }]}>
                        {course.creator.total_courses} {course.creator.total_courses === 1 ? 'Course' : 'Courses'}
                      </Text>
                    ) : null}
                    {course.settings?.show_instructor_students_count === 'yes' && course.creator.total_students ? (
                      <Text style={[styles.instructorStatText, { color: themeColors.textTertiary }]}>
                        {course.creator.total_students} {course.creator.total_students === 1 ? 'Student' : 'Students'}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
            </AnimatedPressable>
          )}

          {/* Progress + Action Button / Lock Screen */}
          {isEnrolled ? (
            <View style={styles.actionSection}>
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
            </View>
          ) : course.lockscreen_config ? (
            <CourseLockScreen
              config={course.lockscreen_config}
              onEnroll={handleEnroll}
              onRequestAccess={course.lockscreen_config.canSendRequest ? handleRequestAccess : undefined}
              isEnrolling={enrolling}
              isRequesting={requesting}
              isPending={isPending}
            />
          ) : (
            <View style={styles.actionSection}>
              <Button
                title="Enroll in Course"
                icon="add-circle-outline"
                onPress={handleEnroll}
                loading={enrolling}
                style={styles.actionButton}
              />
            </View>
          )}

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
              {course.settings.links
                .filter((link) => link.enabled !== 'no')
                .map((link) => (
                <AnimatedPressable
                  key={link.slug || link.permalink}
                  style={styles.linkRow}
                  onPress={() => {
                    if (!link.permalink) return;
                    Linking.openURL(link.permalink);
                  }}
                >
                  <Ionicons name="link-outline" size={16} color={themeColors.primary} />
                  <Text style={[styles.linkText, { color: themeColors.primary }]}>{link.title || link.permalink}</Text>
                  <Ionicons name="open-outline" size={14} color={themeColors.textTertiary} />
                </AnimatedPressable>
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
                isEnrolled={isEnrolled}
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

  instructorBio: {
    fontSize: typography.size.sm,
    marginTop: 4,
    lineHeight: 18,
  },

  instructorStats: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: 4,
  },

  instructorStatText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
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
