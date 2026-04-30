// =============================================================================
// COURSES LIST - Browse all courses or view enrolled courses
// =============================================================================
// Route: /courses
// Features:
// - Toggle between "All Courses" and "My Courses" (enrolled)
// - Search courses by name (debounced)
// - Infinite scroll with pull-to-refresh
//
// Data layer: TanStack Query useInfiniteQuery — pages cached + persisted (MMKV),
// so re-entry renders instantly from cache while revalidating in background.
// =============================================================================

import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useTabContentPadding } from '@/contexts/BottomOffsetContext';

import { CourseCard } from '@/components/course/CourseCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import { PageHeader, HeaderTitle } from '@/components/navigation/PageHeader';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { coursesApi } from '@/services/api/courses';
import { useDebounce } from '@/hooks/useDebounce';
import type { Course, CoursesListResponse } from '@/types/course';

// -----------------------------------------------------------------------------
// Tab type
// -----------------------------------------------------------------------------

type CourseTab = 'all' | 'enrolled';

const PER_PAGE = 15;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CoursesListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const tabContentPadding = useTabContentPadding();

  // Tab, Search & Categories
  const [activeTab, setActiveTab] = useState<CourseTab>('all');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Debounce search so we don't fire a request on every keystroke
  const debouncedSearch = useDebounce(search.trim(), 400);

  // ---------------------------------------------------------------------------
  // Infinite Query
  // ---------------------------------------------------------------------------

  const queryKey = useMemo(
    () => ['courses', activeTab, activeCategory, debouncedSearch] as const,
    [activeTab, activeCategory, debouncedSearch],
  );

  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
    refetch,
    error,
  } = useInfiniteQuery<CoursesListResponse, Error>({
    queryKey,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const page = pageParam as number;
      const response = await coursesApi.getCourses({
        page,
        per_page: PER_PAGE,
        sort_by: 'alphabetical',
        with_categories: page === 1,
        ...(activeTab === 'enrolled' && { type: 'enrolled' }),
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(activeCategory && { topic_slug: activeCategory }),
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load courses');
      }
      return response.data;
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.courses.next_page_url) return undefined;
      return lastPage.courses.current_page + 1;
    },
  });

  // Flatten paginated results — Query gives us pages[], we need a flat list
  const courses: Course[] = useMemo(
    () => data?.pages.flatMap((p) => p.courses.data) ?? [],
    [data],
  );

  // Categories only come back on page 1
  const categories = data?.pages[0]?.course_categories ?? [];

  // Initial-load state vs. refresh state — courses.length distinguishes them
  const showInitialLoading = isLoading && courses.length === 0;
  const isRefreshing = isFetching && !isFetchingNextPage && courses.length > 0;
  const errorMessage = error instanceof Error ? error.message : null;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    refetch();
  };

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
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
          left={<HeaderIconButton icon="chevron-back" onPress={() => router.back()} />}
          center={<HeaderTitle>Courses</HeaderTitle>}
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
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={18} color={themeColors.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Category Chips */}
        {categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChips}
            style={[styles.categoryBar, { borderBottomColor: themeColors.border }]}
          >
            <Pressable
              style={[
                styles.categoryChip,
                { backgroundColor: !activeCategory ? themeColors.primary : themeColors.backgroundSecondary },
              ]}
              onPress={() => setActiveCategory(null)}
            >
              <Text style={[
                styles.categoryChipText,
                { color: !activeCategory ? themeColors.textInverse : themeColors.textSecondary },
              ]}>
                All
              </Text>
            </Pressable>
            {categories.map((cat) => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  { backgroundColor: activeCategory === cat.slug ? themeColors.primary : themeColors.backgroundSecondary },
                ]}
                onPress={() => setActiveCategory(activeCategory === cat.slug ? null : cat.slug)}
              >
                <Text style={[
                  styles.categoryChipText,
                  { color: activeCategory === cat.slug ? themeColors.textInverse : themeColors.textSecondary },
                ]}>
                  {cat.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* Error State */}
        {errorMessage && courses.length === 0 && (
          <ErrorMessage message={errorMessage} onRetry={handleRefresh} />
        )}

        {/* Loading State */}
        {showInitialLoading && !errorMessage && (
          <LoadingSpinner message="Loading courses..." />
        )}

        {/* Courses List */}
        {(courses.length > 0 || (!showInitialLoading && !errorMessage)) && (
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
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={themeColors.primary}
                colors={[themeColors.primary]}
              />
            }
            ListEmptyComponent={
              !showInitialLoading && !errorMessage ? (
                <EmptyState
                  icon="school-outline"
                  message={activeTab === 'enrolled'
                    ? 'You haven\'t enrolled in any courses yet'
                    : debouncedSearch ? 'No courses found' : 'No courses available'}
                />
              ) : null
            }
            ListFooterComponent={
              isFetchingNextPage ? (
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

  // Category chips
  categoryBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  categoryChips: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },

  categoryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.full,
  },

  categoryChipText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  // Footer
  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});
