// =============================================================================
// COURSES WIDGET - Enrolled courses carousel for home page
// =============================================================================
// Fetches user's enrolled courses and renders horizontal cards.
// Uses useAppQuery for stale-while-revalidate caching.
// Returns null if no enrolled courses or fetch fails.
// =============================================================================

import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { coursesApi } from '@/services/api/courses';
import { Course } from '@/types/course';
import { ProgressBar } from '@/components/course/ProgressBar';
import { useAppQuery, WIDGET_STALE_TIME } from '@/hooks/useAppQuery';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.7;
const CARD_GAP = spacing.md;

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface CoursesWidgetProps {
  refreshKey: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CoursesWidget({ refreshKey }: CoursesWidgetProps) {
  const router = useRouter();
  const { colors: themeColors } = useTheme();

  const { data: courses, isLoading } = useAppQuery<Course[]>({
    cacheKey: 'tbc_widget_enrolled_courses',
    fetcher: async () => {
      const response = await coursesApi.getCourses({ type: 'enrolled', per_page: 5 });
      if (!response.success) return [];
      return response.data.courses.data;
    },
    refreshKey,
    refreshOnFocus: false,
    staleTime: WIDGET_STALE_TIME,
  });

  // Loading state on first load only (no cache yet)
  if (isLoading) {
    return (
      <View style={{ padding: spacing.lg, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={themeColors.primary} />
      </View>
    );
  }

  // No enrolled courses — show browse CTA
  if (!courses || courses.length === 0) {
    return (
      <AnimatedPressable
        style={[styles.ctaCard, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}
        onPress={() => router.push('/courses')}
      >
        <Ionicons name="school-outline" size={28} color={themeColors.primary} />
        <Text style={[styles.ctaText, { color: themeColors.primary }]}>Browse Courses</Text>
        <Text style={[styles.ctaSubtext, { color: themeColors.textSecondary }]}>
          Explore available courses and start learning
        </Text>
      </AnimatedPressable>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_WIDTH + CARD_GAP}
      decelerationRate="fast"
      contentContainerStyle={styles.scrollContent}
    >
      {courses.map((course) => {
        const hasCover = course.cover_photo && course.cover_photo.trim() !== ''
          && !course.cover_photo.includes('fluent-community/assets/images/');
        const progress = course.progress ?? 0;

        return (
          <AnimatedPressable
            key={course.id}
            style={[styles.card, { width: CARD_WIDTH, backgroundColor: themeColors.surface }]}
            onPress={() => router.push({ pathname: '/courses/[slug]', params: { slug: course.slug } })}
          >
            {/* Hero Cover */}
            {hasCover ? (
              <Image source={{ uri: course.cover_photo! }} style={styles.cardCover} contentFit="cover" transition={200} cachePolicy="memory-disk" />
            ) : (
              <View style={[styles.cardCover, { backgroundColor: themeColors.lightBg, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="book-outline" size={32} color={themeColors.textTertiary} />
              </View>
            )}

            {/* Gradient Overlay with Title + Progress */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.heroOverlay}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>
                {course.title}
              </Text>
              <View style={styles.cardProgress}>
                <Text style={styles.cardProgressText}>
                  {progress === 100 ? 'Complete' : `${Math.round(progress)}%`}
                </Text>
                <View style={{ flex: 1 }}>
                  <ProgressBar progress={progress} />
                </View>
              </View>
            </LinearGradient>
          </AnimatedPressable>
        );
      })}
    </ScrollView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: CARD_GAP,
  },

  card: {
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    aspectRatio: 16 / 9,
    position: 'relative',
    ...shadows.sm,
  },

  cardCover: {
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
    paddingTop: 30,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },

  cardTitle: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    color: '#fff',
    marginBottom: spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  cardProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  cardProgressText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    color: 'rgba(255,255,255,0.85)',
    minWidth: 48,
  },

  // CTA Card
  ctaCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    borderRadius: sizing.borderRadius.md,
    alignItems: 'center',
    gap: spacing.sm,
  },

  ctaText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  ctaSubtext: {
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
});

export default CoursesWidget;
