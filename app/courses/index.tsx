// =============================================================================
// COURSES LIST - Browse all courses or view enrolled courses
// =============================================================================
// Route: /courses
// Features:
// - Toggle between "All Courses" and "My Courses" (enrolled)
// - Search courses by name
// - Infinite scroll with pull-to-refresh
// =============================================================================

import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTabContentPadding } from '@/contexts/BottomOffsetContext';

import { CourseCard } from '@/components/course/CourseCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader } from '@/components/navigation/PageHeader';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { coursesApi } from '@/services/api/courses';
import { Course } from '@/types/course';

// -----------------------------------------------------------------------------
// Tab type
// -----------------------------------------------------------------------------

type CourseTab = 'all' | 'enrolled';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CoursesListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const tabContentPadding = useTabContentPadding();

  // Data state
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Tab & Search
  const [activeTab, setActiveTab] = useState<CourseTab>('all');
  const [search, setSearch] = useState('');
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch Courses
  // ---------------------------------------------------------------------------

  const fetchCourses = useCallback(async (pageNum: number = 1, shouldAppend: boolean = false) => {
    try {
      if (pageNum === 1) {
        if (shouldAppend) return; // prevent double-fetch
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await coursesApi.getCourses({
        page: pageNum,
        per_page: 15,
        sort_by: 'alphabetical',
        ...(activeTab === 'enrolled' && { type: 'enrolled' }),
        ...(search.trim() && { search: search.trim() }),
      });

      if (!response.success) {
        setError(response.error?.message || 'Failed to load courses');
        return;
      }

      const { courses: paginatedCourses } = response.data;
      const newCourses = paginatedCourses.data;

      if (shouldAppend) {
        setCourses((prev) => [...prev, ...newCourses]);
      } else {
        setCourses(newCourses);
      }

      setHasMore(paginatedCourses.next_page_url != null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, search]);

  // Initial fetch & refetch on tab change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    setCourses([]);
    fetchCourses(1, false);
  }, [activeTab, fetchCourses]);

  // Debounced search
  const handleSearchChange = (text: string) => {
    setSearch(text);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      setHasMore(true);
      setCourses([]);
      fetchCourses(1, false);
    }, 400);
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    setPage(1);
    setHasMore(true);
    fetchCourses(1, false);
  };

  const handleLoadMore = () => {
    if (!loading && !refreshing && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchCourses(nextPage, true);
    }
  };

  const handleCoursePress = (course: Course) => {
    router.push({ pathname: '/courses/[slug]', params: { slug: course.slug } });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { backgroundColor: themeColors.background, paddingTop: insets.top }]}>
        {/* Header */}
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title="Courses"
        />

        {/* Tab Toggle + Search */}
        <View style={[styles.controlsContainer, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          {/* Segmented Control */}
          <View style={[styles.segmentedControl, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Pressable
              style={[styles.segment, activeTab === 'all' && { backgroundColor: themeColors.surface }]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.segmentText, { color: activeTab === 'all' ? themeColors.text : themeColors.textTertiary }]}>
                All Courses
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segment, activeTab === 'enrolled' && { backgroundColor: themeColors.surface }]}
              onPress={() => setActiveTab('enrolled')}
            >
              <Text style={[styles.segmentText, { color: activeTab === 'enrolled' ? themeColors.text : themeColors.textTertiary }]}>
                My Courses
              </Text>
            </Pressable>
          </View>

          {/* Search Bar */}
          <View style={[styles.searchInputWrapper, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Ionicons name="search-outline" size={18} color={themeColors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder="Search courses..."
              placeholderTextColor={themeColors.textTertiary}
              value={search}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => { setSearch(''); handleSearchChange(''); }}>
                <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Error State */}
        {error && !loading && courses.length === 0 && (
          <ErrorMessage message={error} onRetry={handleRefresh} />
        )}

        {/* Loading State */}
        {loading && courses.length === 0 && !error && (
          <LoadingSpinner message="Loading courses..." />
        )}

        {/* Courses List */}
        {(courses.length > 0 || (!loading && !error)) && (
          <FlashList
            data={courses}
            renderItem={({ item }) => (
              <CourseCard course={item} onPress={() => handleCoursePress(item)} />
            )}
            keyExtractor={(item) => String(item.id)}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={themeColors.primary}
                colors={[themeColors.primary]}
              />
            }
            ListEmptyComponent={
              !loading && !error ? (
                <EmptyState
                  icon="school-outline"
                  message={activeTab === 'enrolled'
                    ? 'You haven\'t enrolled in any courses yet'
                    : search ? 'No courses found' : 'No courses available'}
                />
              ) : null
            }
            ListFooterComponent={
              loading && page > 1 ? (
                <View style={styles.footerLoader}>
                  <ActivityIndicator size="small" color={themeColors.primary} />
                </View>
              ) : null
            }
            contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: tabContentPadding }}
          />
        )}
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

  // Controls (tabs + search)
  controlsContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },

  segmentedControl: {
    flexDirection: 'row',
    borderRadius: sizing.borderRadius.sm,
    padding: 3,
  },

  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
    alignItems: 'center',
  },

  segmentText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: sizing.borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },

  searchInput: {
    flex: 1,
    fontSize: typography.size.md,
    paddingVertical: 0,
  },

  // Footer
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
