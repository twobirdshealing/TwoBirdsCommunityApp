// =============================================================================
// COURSES WIDGET - Enrolled courses carousel for home page
// =============================================================================
// Fetches user's enrolled courses and renders horizontal cards.
// Uses useCachedData for stale-while-revalidate caching.
// Returns null if no enrolled courses or fetch fails.
// =============================================================================

import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { withOpacity } from '@/constants/colors';
import { coursesApi } from '@/services/api/courses';
import { Course } from '@/types/course';
import { ProgressBar } from '@/components/course';
import { useCachedData } from '@/hooks/useCachedData';

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

  const { data: courses, isLoading } = useCachedData<Course[]>({
    cacheKey: 'tbc_widget_enrolled_courses',
    fetcher: async () => {
      const response = await coursesApi.getCourses({ type: 'enrolled', per_page: 5 });
      if (!response.success) return [];
      return response.data.courses.data;
    },
    refreshKey,
    refreshOnFocus: false,
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
      <TouchableOpacity
        style={[styles.ctaCard, { backgroundColor: withOpacity(themeColors.primary, 0.1) }]}
        onPress={() => router.push('/courses')}
        activeOpacity={0.7}
      >
        <Ionicons name="school-outline" size={28} color={themeColors.primary} />
        <Text style={[styles.ctaText, { color: themeColors.primary }]}>Browse Courses</Text>
        <Text style={[styles.ctaSubtext, { color: themeColors.textSecondary }]}>
          Explore available courses and start learning
        </Text>
      </TouchableOpacity>
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
        const hasCover = course.cover_photo && course.cover_photo.trim() !== '';
        const progress = course.progress ?? 0;

        return (
          <Pressable
            key={course.id}
            style={({ pressed }) => [
              styles.card,
              { width: CARD_WIDTH, backgroundColor: themeColors.surface },
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push({ pathname: '/courses/[slug]', params: { slug: course.slug } })}
          >
            {/* Cover */}
            {hasCover ? (
              <Image source={{ uri: course.cover_photo! }} style={styles.cardCover} resizeMode="cover" />
            ) : (
              <LinearGradient
                colors={['#6366f1', '#8b5cf6', '#d946ef']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardCover}
              />
            )}

            {/* Content */}
            <View style={styles.cardContent}>
              <Text style={[styles.cardTitle, { color: themeColors.text }]} numberOfLines={2}>
                {course.title}
              </Text>
              <View style={styles.cardProgress}>
                <View style={{ flex: 1 }}>
                  <ProgressBar progress={progress} />
                </View>
                <Text style={[styles.cardProgressText, { color: themeColors.textTertiary }]}>
                  {progress === 100 ? 'Complete' : `${Math.round(progress)}%`}
                </Text>
              </View>
            </View>
          </Pressable>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },

  cardCover: {
    width: '100%',
    height: 100,
  },

  cardContent: {
    flex: 1,
    padding: spacing.md,
  },

  cardTitle: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },

  cardProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 'auto',
  },

  cardProgressText: {
    fontSize: typography.size.xs,
    fontWeight: '500',
    minWidth: 48,
    textAlign: 'right',
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
    fontWeight: '600',
  },

  ctaSubtext: {
    fontSize: typography.size.sm,
    textAlign: 'center',
  },
});

export default CoursesWidget;
