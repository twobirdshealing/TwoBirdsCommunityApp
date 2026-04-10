// =============================================================================
// MAIN SPACES SCREEN - Shows spaces organized by group tabs
// =============================================================================
// Uses /spaces/discover endpoint to show all discoverable spaces.
// Group-based horizontal tabs filter by space group.
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import { TabActivityWrapper } from '@/components/common/TabActivityWrapper';
import { SpaceCard } from '@/components/space/SpaceCard';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTabContentPadding } from '@/contexts/BottomOffsetContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { spacesApi } from '@/services/api/spaces';
import { useAppQuery } from '@/hooks/useAppQuery';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
import { Space, SpaceGroupOption } from '@/types/space';
import { createLogger } from '@/utils/logger';

const log = createLogger('SpacesScreen');

// Special ID for ungrouped spaces tab
const OTHER_GROUP_ID = 0;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SpacesScreen() {
  const router = useRouter();
  const { colors: themeColors } = useTheme();
  const bottomPadding = useTabContentPadding();
  const { handleScroll } = useTabBar();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [showTabFade, setShowTabFade] = useState(true);

  // ---------------------------------------------------------------------------
  // Fetch Groups + Spaces in parallel
  // ---------------------------------------------------------------------------

  interface SpacesData {
    spaces: Space[];
    groups: SpaceGroupOption[];
  }

  const {
    data,
    isLoading: loading,
    isRefreshing: refreshing,
    error: fetchError,
    refresh,
  } = useAppQuery<SpacesData>({
    cacheKey: 'tbc_spaces_all',
    invalidateOn: CACHE_EVENTS.SPACES,
    fetcher: async () => {
      const [groupsRes, spacesRes] = await Promise.all([
        spacesApi.getSpaceGroups({ options_only: true }),
        spacesApi.discoverSpaces({ per_page: 100 }),
      ]);

      if (!spacesRes.success) {
        throw new Error(spacesRes.error?.message || 'Failed to load spaces');
      }

      return {
        spaces: spacesRes.data.spaces?.data || [],
        groups: groupsRes.success ? (groupsRes.data.groups || []) : [],
      };
    },
  });

  const spaces = data?.spaces || [];
  const groups = data?.groups || [];
  const error = fetchError?.message || null;

  // ---------------------------------------------------------------------------
  // Build group tabs with counts
  // ---------------------------------------------------------------------------

  const { tabs, groupedMap } = useMemo(() => {
    const map = new Map<number, Space[]>();
    const ungrouped: Space[] = [];

    for (const space of spaces) {
      const parentId = space.parent_id ? Number(space.parent_id) : null;
      if (parentId) {
        const existing = map.get(parentId) || [];
        existing.push(space);
        map.set(parentId, existing);
      } else {
        ungrouped.push(space);
      }
    }

    // Sort spaces within each group by serial
    for (const [, groupSpaces] of map) {
      groupSpaces.sort((a, b) => (Number(a.serial) || 0) - (Number(b.serial) || 0));
    }

    // Build tab list from groups (API order) + Other
    const tabList: { id: number; title: string; count: number }[] = [];
    for (const group of groups) {
      const count = map.get(group.id)?.length || 0;
      tabList.push({ id: group.id, title: group.title, count });
    }
    if (ungrouped.length > 0) {
      map.set(OTHER_GROUP_ID, ungrouped);
      tabList.push({ id: OTHER_GROUP_ID, title: 'Other Spaces', count: ungrouped.length });
    }

    return { tabs: tabList, groupedMap: map };
  }, [spaces, groups]);

  // Default to first tab with spaces, or first tab overall
  useEffect(() => {
    if (activeGroupId === null && tabs.length > 0) {
      const firstWithSpaces = tabs.find(t => t.count > 0);
      setActiveGroupId(firstWithSpaces?.id ?? tabs[0].id);
    }
  }, [tabs, activeGroupId]);

  // ---------------------------------------------------------------------------
  // Filter spaces for active tab + search
  // ---------------------------------------------------------------------------

  const displayedSpaces = useMemo(() => {
    if (activeGroupId === null) return [];

    let list = groupedMap.get(activeGroupId) || [];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter(space =>
        space.title?.toLowerCase().includes(query) ||
        space.description?.toLowerCase().includes(query) ||
        space.slug?.toLowerCase().includes(query)
      );
    }

    return list;
  }, [activeGroupId, groupedMap, searchQuery]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const [joiningSlug, setJoiningSlug] = useState<string | null>(null);

  const handleRefresh = () => { refresh(); };
  const handleSpacePress = (space: Space) => { router.push(`/space/${space.slug}`); };
  const handleClearSearch = () => setSearchQuery('');

  const handleJoinSpace = async (space: Space) => {
    if (joiningSlug) return;
    setJoiningSlug(space.slug);
    try {
      const response = await spacesApi.joinSpace(space.slug);
      if (response.success) {
        cacheEvents.emit(CACHE_EVENTS.SPACES);
        refresh();
      } else {
        Alert.alert('Error', response.error?.message || 'Failed to join space');
      }
    } catch (err) {
      log.error(err, 'Join space error');
      Alert.alert('Error', 'Failed to join space');
    } finally {
      setJoiningSlug(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const renderItem = ({ item }: { item: Space }) => (
    <SpaceCard
      space={item}
      onPress={() => handleSpacePress(item)}
      onJoin={() => handleJoinSpace(item)}
      isJoining={joiningSlug === item.slug}
    />
  );

  return (
    <TabActivityWrapper>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <View style={[styles.searchInputContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Ionicons name="search-outline" size={20} color={themeColors.textTertiary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder="Search spaces..."
              placeholderTextColor={themeColors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Text style={[styles.clearButton, { color: themeColors.textTertiary }]} onPress={handleClearSearch}>
                ✕
              </Text>
            )}
          </View>

          {/* Group Tabs */}
          {tabs.length > 1 && (
            <View style={styles.tabsWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsContent}
                style={styles.tabsScroll}
                onScroll={(e) => {
                  const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                  setShowTabFade(contentOffset.x + layoutMeasurement.width < contentSize.width - 8);
                }}
                scrollEventThrottle={16}
              >
                {tabs.map(tab => {
                  const isActive = tab.id === activeGroupId;
                  return (
                    <Pressable
                      key={tab.id}
                      onPress={() => setActiveGroupId(tab.id)}
                      style={[
                        styles.groupTab,
                        isActive
                          ? { backgroundColor: themeColors.primary }
                          : { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border, borderWidth: 1 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.groupTabText,
                          { color: isActive ? themeColors.textInverse : themeColors.text },
                        ]}
                        numberOfLines={1}
                      >
                        {tab.title}
                      </Text>
                      <View style={[
                        styles.groupTabCount,
                        { backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : themeColors.border },
                      ]}>
                        <Text style={[
                          styles.groupTabCountText,
                          { color: isActive ? themeColors.textInverse : themeColors.textSecondary },
                        ]}>
                          {tab.count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {showTabFade && (
                <LinearGradient
                  colors={['transparent', themeColors.surface]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.tabsFade}
                  pointerEvents="none"
                />
              )}
            </View>
          )}

          {/* Result count when searching */}
          {searchQuery.length > 0 && (
            <Text style={[styles.resultCount, { color: themeColors.textSecondary }]}>
              {displayedSpaces.length} result{displayedSpaces.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>

        {/* Error State */}
        {error && !loading && spaces.length === 0 && (
          <ErrorMessage message={error} onRetry={handleRefresh} />
        )}

        {/* Loading State */}
        {loading && spaces.length === 0 && (
          <LoadingSpinner message="Loading spaces..." />
        )}

        {/* Spaces List */}
        {!loading && displayedSpaces.length > 0 && (
          <FlashList
            data={displayedSpaces}
            renderItem={renderItem}
            keyExtractor={(item) => `space-${item.id}`}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={themeColors.primary}
                colors={[themeColors.primary]}
              />
            }
            contentContainerStyle={[styles.listContent, { paddingBottom: bottomPadding }]}
          />
        )}

        {/* Empty search results */}
        {!loading && displayedSpaces.length === 0 && searchQuery.length > 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color={themeColors.textTertiary} style={styles.emptyIcon} />
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>No spaces match "{searchQuery}"</Text>
            <Text style={[styles.clearSearchButton, { color: themeColors.primary }]} onPress={handleClearSearch}>
              Clear search
            </Text>
          </View>
        )}

        {/* Empty State (no spaces at all) */}
        {!loading && !error && spaces.length === 0 && (
          <EmptyState
            icon="people-outline"
            title="No spaces yet"
            message="No spaces are available right now"
          />
        )}

        {/* Empty tab (tab selected but no spaces in it, not searching) */}
        {!loading && displayedSpaces.length === 0 && searchQuery.length === 0 && spaces.length > 0 && (
          <EmptyState
            icon="people-outline"
            title="No spaces in this group"
            message="Try selecting a different group"
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

  // Search Bar
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: sizing.borderRadius.sm,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md,
  },
  clearButton: {
    fontSize: typography.size.md,
    padding: spacing.xs,
  },

  // Group Tabs
  tabsWrapper: {
    position: 'relative',
    marginTop: spacing.sm,
  },
  tabsScroll: {},
  tabsContent: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tabsFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 32,
  },
  groupTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.lg,
    gap: spacing.xs,
  },
  groupTabText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
  groupTabCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: sizing.borderRadius.sm,
    minWidth: 20,
    alignItems: 'center',
  },
  groupTabCountText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
  },

  resultCount: {
    fontSize: typography.size.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // List
  listContent: {
    paddingTop: spacing.xs,
  },

  // States
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyIcon: {
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.size.md,
    textAlign: 'center',
  },
  clearSearchButton: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.md,
  },
});
