// =============================================================================
// HOME SCREEN - Widget-based dynamic home page
// =============================================================================
// Renders self-contained widgets in a user-customizable order.
// Long-press any widget header to enter edit mode (drag to reorder, toggle
// visibility). Preferences persist across sessions via AsyncStorage.
//
// Normal mode: FlashList with RefreshControl (pull-to-refresh works)
// Edit mode: DraggableFlatList (drag-to-reorder works)
// We split these because DraggableFlatList's PanGestureHandler steals the
// vertical pan gesture from RefreshControl even when drag is disabled.
// =============================================================================

import React, { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list';
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from 'react-native-draggable-flatlist';
import { useRouter } from 'expo-router';
import { spacing } from '@/constants/layout';
import { useTabContentPadding } from '@/contexts/BottomOffsetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useFeatures } from '@/contexts/AppConfigContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { hapticMedium } from '@/utils/haptics';
import { useWidgetPreferences, WidgetPreference } from '@/hooks/useWidgetPreferences';
import { useAppFocus } from '@/hooks/useAppFocus';
import { getAvailableWidgets, getCoreWidgetComponentMap } from '@/components/home/widgetRegistry';
import { getWidgetComponentMap } from '@/modules/_registry';
import type { WidgetRegistration } from '@/modules/_types';
import { HomeWidget } from '@/components/home/HomeWidget';
import { WelcomeBannerWidget } from '@/components/home/WelcomeBannerWidget';
import { EditModeBar } from '@/components/home/EditModeBar';
import { TabActivityWrapper } from '@/components/common/TabActivityWrapper';

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
  const bottomInset = useTabContentPadding();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  // Refresh all widgets when app returns from background
  useAppFocus(useCallback(() => setRefreshKey((prev) => prev + 1), []));

  const { handleScroll, setLocked } = useTabBar();

  const {
    preferences,
    isLoading,
    reorder,
    toggleWidget,
    resetToDefaults,
  } = useWidgetPreferences();

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
  // Build Widget List
  // ---------------------------------------------------------------------------

  const widgetItems = useMemo<WidgetItem[]>(() => {
    if (!preferences) return [];
    const available = getAvailableWidgets(features);
    const registryMap = new Map(available.map((w) => [w.id, w]));

    return preferences.order
      .map((pref) => {
        const config = registryMap.get(pref.id);
        if (!config) return null;
        return { pref, config };
      })
      .filter((item): item is WidgetItem => item !== null);
  }, [preferences, features]);

  // ---------------------------------------------------------------------------
  // Edit Mode
  // ---------------------------------------------------------------------------

  const enterEditMode = useCallback(() => {
    hapticMedium();
    setIsEditing(true);
    setLocked(true);
  }, [setLocked]);

  const exitEditMode = useCallback(() => {
    setIsEditing(false);
    setLocked(false);
  }, [setLocked]);

  // ---------------------------------------------------------------------------
  // Drag End
  // ---------------------------------------------------------------------------

  const handleDragEnd = useCallback(
    ({ data }: { data: WidgetItem[] }) => {
      reorder(data.map((item) => item.pref));
    },
    [reorder],
  );

  // ---------------------------------------------------------------------------
  // Shared Widget Renderer
  // ---------------------------------------------------------------------------

  const renderWidget = useCallback(
    (
      item: WidgetItem,
      drag?: () => void,
      isActive?: boolean,
    ): React.ReactElement | null => {
      const { pref, config } = item;
      const WidgetComponent = WIDGET_COMPONENTS[config.id];
      if (!WidgetComponent) return null;

      // In normal mode, skip disabled widgets entirely
      if (!isEditing && !pref.enabled) return null;

      const seeAllHandler = config.seeAllRoute
        ? () => router.push(config.seeAllRoute as any)
        : undefined;

      // Standard wrapped widgets
      return (
        <HomeWidget
          title={config.title}
          icon={config.icon}
          onSeeAll={!isEditing ? seeAllHandler : undefined}
          isEditing={isEditing}
          isEnabled={pref.enabled}
          canDisable={config.canDisable}
          onToggle={() => toggleWidget(config.id)}
          drag={drag}
          isActive={isActive}
          onEnterEditMode={enterEditMode}
        >
          {pref.enabled && <WidgetComponent refreshKey={refreshKey} />}
        </HomeWidget>
      );
    },
    [isEditing, refreshKey, toggleWidget, router, enterEditMode],
  );

  // ---------------------------------------------------------------------------
  // Render Item (Normal mode — FlashList)
  // ---------------------------------------------------------------------------

  const renderNormalItem = useCallback(
    ({ item }: ListRenderItemInfo<WidgetItem>) => renderWidget(item),
    [renderWidget],
  );

  // ---------------------------------------------------------------------------
  // Render Item (Edit mode — DraggableFlatList)
  // ---------------------------------------------------------------------------

  const renderDragItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<WidgetItem>) => (
      <ScaleDecorator>{renderWidget(item, drag, isActive)}</ScaleDecorator>
    ),
    [renderWidget],
  );

  // ---------------------------------------------------------------------------
  // Key Extractor
  // ---------------------------------------------------------------------------

  const keyExtractor = useCallback((item: WidgetItem) => item.config.id, []);

  // ---------------------------------------------------------------------------
  // Header (pinned welcome banner — always top, not part of widget system)
  // ---------------------------------------------------------------------------

  const ListHeader = useCallback(
    () => (
      <View style={{ paddingBottom: spacing.md }}>
        <WelcomeBannerWidget refreshKey={refreshKey} />
      </View>
    ),
    [refreshKey],
  );

  // ---------------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------------

  const ListFooter = useCallback(
    () => <View style={{ height: bottomInset }} />,
    [bottomInset],
  );

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
        {/* Edit Mode Header Bar */}
        {isEditing && (
          <EditModeBar onDone={exitEditMode} onReset={resetToDefaults} />
        )}

        {isEditing ? (
          // Edit mode: DraggableFlatList for drag-to-reorder
          <DraggableFlatList
            data={widgetItems}
            keyExtractor={keyExtractor}
            renderItem={renderDragItem}
            onDragEnd={handleDragEnd}
            onDragBegin={() => hapticMedium()}
            contentContainerStyle={styles.scrollContent}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
          />
        ) : (
          // Normal mode: FlashList with pull-to-refresh
          <FlashList
            data={widgetItems}
            keyExtractor={keyExtractor}
            renderItem={renderNormalItem}
            contentContainerStyle={styles.scrollContent}
            ListHeaderComponent={ListHeader}
            ListFooterComponent={ListFooter}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
          />
        )}
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
});
