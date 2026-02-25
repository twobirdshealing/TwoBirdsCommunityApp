// =============================================================================
// HOME SCREEN - Widget-based dynamic home page
// =============================================================================
// Renders self-contained widgets: Welcome Banner, Events, Media Carousel.
// Each widget fetches its own data and manages its own loading/error state.
// =============================================================================

import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { spacing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { FEATURES } from '@/constants/config';
import {
  HomeWidget,
  WelcomeBannerWidget,
  MediaCarousel,
  EventsWidget,
  CoursesWidget,
} from '@/components/home';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const { colors: themeColors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // ---------------------------------------------------------------------------
  // Pull-to-Refresh
  // ---------------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    // Small delay so widgets have time to start fetching
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Featured Events — top of page */}
        <HomeWidget
          title="Featured Events"
          icon="calendar-outline"
          onSeeAll={() => router.push('/(tabs)/calendar')}
        >
          <EventsWidget refreshKey={refreshKey} />
        </HomeWidget>

        {/* Welcome Banner */}
        <WelcomeBannerWidget refreshKey={refreshKey} />

        {/* My Courses */}
        {FEATURES.COURSES && (
          <HomeWidget
            title="My Courses"
            icon="school-outline"
            onSeeAll={() => router.push('/courses')}
          >
            <CoursesWidget refreshKey={refreshKey} />
          </HomeWidget>
        )}

        {/* Media Carousel — swipeable blog + YouTube */}
        <HomeWidget title="Latest" icon="sparkles-outline">
          <MediaCarousel refreshKey={refreshKey} />
        </HomeWidget>

        {/* Bottom padding for tab bar */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
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
    paddingTop: spacing.md,
  },

  bottomPadding: {
    height: 80,
  },
});
