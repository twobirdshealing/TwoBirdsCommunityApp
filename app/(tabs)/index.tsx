// =============================================================================
// HOME SCREEN - Widget-based dynamic home page
// =============================================================================
// Renders self-contained widgets in a user-customizable order.
// Long-press any widget to drag and reorder — order persists via MMKV.
// Uses Sortable.Grid (columns=1) for smooth drag animations.
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedRef } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import Sortable from 'react-native-sortables';
import type { SortableGridRenderItem } from 'react-native-sortables';
import { spacing } from '@/constants/layout';
import { useTabContentPadding } from '@/contexts/BottomOffsetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppConfig, useFeatures } from '@/contexts/AppConfigContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { hapticMedium, hapticSelection } from '@/utils/haptics';
import { useWidgetPreferences } from '@/hooks/useWidgetPreferences';
import { useAppFocus } from '@/hooks/useAppFocus';
import { getAvailableWidgets, getCoreWidgetComponentMap } from '@/components/home/widgetRegistry';
import { getWidgetComponentMap } from '@/modules/_registry';
import type { WidgetRegistration } from '@/modules/_types';
import { HomeWidget } from '@/components/home/HomeWidget';
import { WelcomeBannerWidget } from '@/components/home/WelcomeBannerWidget';
import { TabActivityWrapper } from '@/components/common/TabActivityWrapper';
import { EMPTY_HIDE_MENU } from '@/utils/visibility';
import type { WidgetPreference } from '@/hooks/useWidgetPreferences';

// -----------------------------------------------------------------------------
// Widget Component Map — core + module widgets (unified)
// -----------------------------------------------------------------------------

const WIDGET_COMPONENTS: Record<
  string,
  React.ComponentType<{ refreshKey: number }>
> = {
  ...getCoreWidgetComponentMap(),
  ...getWidgetComponentMap(),
};

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface WidgetItem {
  pref: WidgetPreference;
  config: WidgetRegistration;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const { colors: themeColors } = useTheme();
  const features = useFeatures();
  const { visibility } = useAppConfig();
  const hideMenu = visibility?.hide_menu ?? EMPTY_HIDE_MENU;
  const bottomInset = useTabContentPadding();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const scrollableRef = useAnimatedRef<Animated.ScrollView>();

  // Refresh all widgets when app returns from background
  useAppFocus(useCallback(() => setRefreshKey((prev) => prev + 1), []));

  const { handleScroll } = useTabBar();

  const {
    preferences,
    isLoading,
    reorder,
  } = useWidgetPreferences();

  // ---------------------------------------------------------------------------
  // Pull-to-Refresh
  // ---------------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // ---------------------------------------------------------------------------
  // Build Widget List (welcome banner + registered widgets)
  // ---------------------------------------------------------------------------

  const widgetItems = useMemo<WidgetItem[]>(() => {
    if (!preferences) return [];
    const available = getAvailableWidgets(features, hideMenu);
    const registryMap = new Map(available.map((w) => [w.id, w]));

    return preferences.order
      .map((pref) => {
        const config = registryMap.get(pref.id);
        if (!config) return null;
        if (!pref.enabled) return null;
        return { pref, config };
      })
      .filter((item): item is WidgetItem => item !== null);
  }, [preferences, features, hideMenu]);

  // ---------------------------------------------------------------------------
  // Sortable Callbacks
  // ---------------------------------------------------------------------------

  const handleDragStart = useCallback(() => {
    hapticMedium();
  }, []);

  const handleOrderChange = useCallback(() => {
    hapticSelection();
  }, []);

  const handleDragEnd = useCallback(
    ({ data }: { data: WidgetItem[] }) => {
      hapticMedium();
      // Merge reordered enabled items with disabled items so they aren't lost
      const enabledOrder = data.map((item) => item.pref);
      const disabledItems = preferences?.order.filter((p) => !p.enabled) ?? [];
      reorder([...enabledOrder, ...disabledItems]);
    },
    [reorder, preferences],
  );

  // ---------------------------------------------------------------------------
  // Widget Renderer
  // ---------------------------------------------------------------------------

  const renderWidget = useCallback<SortableGridRenderItem<WidgetItem>>(
    ({ item }) => {
      const { config } = item;
      const WidgetComponent = WIDGET_COMPONENTS[config.id];
      if (!WidgetComponent) return null;

      const seeAllHandler = config.seeAllRoute
        ? () => router.push(config.seeAllRoute as any)
        : undefined;

      return (
        <HomeWidget
          title={config.title}
          icon={config.icon}
          onSeeAll={seeAllHandler}
        >
          <WidgetComponent refreshKey={refreshKey} />
        </HomeWidget>
      );
    },
    [refreshKey, router],
  );

  const keyExtractor = useCallback((item: WidgetItem) => item.config.id, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading || !preferences) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]} />
    );
  }

  return (
    <TabActivityWrapper>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Animated.ScrollView
          ref={scrollableRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomInset },
          ]}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Welcome Banner — locked at top, not reorderable */}
          <View style={styles.bannerContainer}>
            <WelcomeBannerWidget refreshKey={refreshKey} />
          </View>

          <Sortable.Grid
            data={widgetItems}
            columns={1}
            renderItem={renderWidget}
            keyExtractor={keyExtractor}
            onDragStart={handleDragStart}
            onOrderChange={handleOrderChange}
            onDragEnd={handleDragEnd}
            scrollableRef={scrollableRef}
            rowGap={0}
            columnGap={0}
            dragActivationDelay={400}
            activeItemScale={1.02}
            activeItemOpacity={1}
            activeItemShadowOpacity={0.2}
            inactiveItemOpacity={0.5}
            activationAnimationDuration={250}
            dropAnimationDuration={400}
          />
        </Animated.ScrollView>
      </View>
    </TabActivityWrapper>
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

  bannerContainer: {
    paddingBottom: spacing.md,
  },
});
