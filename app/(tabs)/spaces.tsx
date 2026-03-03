// =============================================================================
// MAIN SPACES SCREEN - Shows spaces organized by group
// =============================================================================
// Fetches space groups (options_only) and user's spaces (profile endpoint)
// to display grouped spaces with member counts and role badges.
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import { SpaceCard } from '@/components/space/SpaceCard';
import { spacing, typography, sizing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useAudioPlayerContext } from '@/contexts/AudioPlayerContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { profilesApi } from '@/services/api/profiles';
import { spacesApi } from '@/services/api/spaces';
import { useCachedData } from '@/hooks/useCachedData';
import { Space, SpaceGroupOption } from '@/types/space';

// -----------------------------------------------------------------------------
// Types for the flat list (spaces + group headers)
// -----------------------------------------------------------------------------

type GroupHeaderItem = {
  _type: 'group_header';
  id: number;
  title: string;
  count: number;
};

type SpaceItem = {
  _type: 'space';
  space: Space;
};

type ListItem = GroupHeaderItem | SpaceItem;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SpacesScreen() {
  const router = useRouter();
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const { currentBook } = useAudioPlayerContext();
  const bottomPadding = sizing.height.tabBar + insets.bottom + (currentBook ? 59 : 0) + spacing.md;
  const { handleScroll } = useTabBar();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');

  // ---------------------------------------------------------------------------
  // Fetch Groups + Spaces in parallel (cached + auto-refresh on app focus)
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
  } = useCachedData<SpacesData>({
    cacheKey: 'tbc_spaces_list',
    fetcher: async () => {
      const [groupsRes, spacesRes] = await Promise.all([
        spacesApi.getSpaceGroups({ options_only: true }),
        user?.username
          ? profilesApi.getUserSpaces(user.username)
          : spacesApi.getSpaces({ status: 'published' }),
      ]);

      if (!spacesRes.success) {
        throw new Error(spacesRes.error?.message || 'Failed to load spaces');
      }

      return {
        spaces: spacesRes.data.spaces || [],
        groups: groupsRes.success ? (groupsRes.data.groups || []) : [],
      };
    },
  });

  const spaces = data?.spaces || [];
  const groups = data?.groups || [];
  const error = fetchError?.message || null;

  // ---------------------------------------------------------------------------
  // Client-side Search Filter
  // ---------------------------------------------------------------------------

  const filteredSpaces = useMemo(() => {
    if (!searchQuery.trim()) return spaces;

    const query = searchQuery.toLowerCase().trim();
    return spaces.filter(space =>
      space.title?.toLowerCase().includes(query) ||
      space.description?.toLowerCase().includes(query) ||
      space.slug?.toLowerCase().includes(query)
    );
  }, [spaces, searchQuery]);

  // ---------------------------------------------------------------------------
  // Build grouped flat list data
  // ---------------------------------------------------------------------------

  const listData = useMemo((): ListItem[] => {
    const items: ListItem[] = [];
    const spacesToGroup = filteredSpaces;

    // Build a map of group_id → spaces
    const groupedSpaces = new Map<string, Space[]>();
    const ungroupedSpaces: Space[] = [];

    for (const space of spacesToGroup) {
      const parentId = space.parent_id?.toString();
      if (parentId) {
        const existing = groupedSpaces.get(parentId) || [];
        existing.push(space);
        groupedSpaces.set(parentId, existing);
      } else {
        ungroupedSpaces.push(space);
      }
    }

    // Add groups in API order (preserves admin-configured ordering)
    for (const group of groups) {
      const groupSpaces = groupedSpaces.get(group.id.toString()) || [];
      if (groupSpaces.length === 0 && searchQuery.trim()) continue; // Hide empty groups when searching

      // Sort spaces within group by serial
      groupSpaces.sort((a, b) => {
        const aSerial = Number(a.serial) || 0;
        const bSerial = Number(b.serial) || 0;
        return aSerial - bSerial;
      });

      items.push({
        _type: 'group_header',
        id: group.id,
        title: group.title,
        count: groupSpaces.length,
      });

      for (const space of groupSpaces) {
        items.push({ _type: 'space', space });
      }
    }

    // Add any ungrouped spaces at the end
    if (ungroupedSpaces.length > 0) {
      if (groups.length > 0) {
        items.push({
          _type: 'group_header',
          id: 0,
          title: 'Other Spaces',
          count: ungroupedSpaces.length,
        });
      }
      for (const space of ungroupedSpaces) {
        items.push({ _type: 'space', space });
      }
    }

    return items;
  }, [filteredSpaces, groups, searchQuery]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => { refresh(); };

  const handleSpacePress = (space: Space) => {
    router.push(`/space/${space.slug}`);
  };

  const handleClearSearch = () => setSearchQuery('');

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item._type === 'group_header') {
      return (
        <View style={[styles.groupHeader, { backgroundColor: themeColors.backgroundSecondary, borderBottomColor: themeColors.border }]}>
          <Text style={[styles.groupTitle, { color: themeColors.text }]}>{item.title}</Text>
          <View style={[styles.groupCountBadge, { backgroundColor: themeColors.border }]}>
            <Text style={[styles.groupCountText, { color: themeColors.textSecondary }]}>
              {item.count}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <SpaceCard space={item.space} onPress={() => handleSpacePress(item.space)} />
    );
  };

  const getItemType = (item: ListItem) => item._type;

  return (
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

        {/* Result count when searching */}
        {searchQuery.length > 0 && (
          <Text style={[styles.resultCount, { color: themeColors.textSecondary }]}>
            {filteredSpaces.length} of {spaces.length} spaces
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

      {/* Grouped Spaces List */}
      {!loading && listData.length > 0 && (
        <FlashList
          data={listData}
          renderItem={renderItem}
          getItemType={getItemType}
          keyExtractor={(item) =>
            item._type === 'group_header'
              ? `group-${item.id}`
              : `space-${item.space.id}`
          }
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
          ListEmptyComponent={
            searchQuery.length > 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={48} color={themeColors.textTertiary} style={styles.emptyIcon} />
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>No spaces match "{searchQuery}"</Text>
                <Text style={[styles.clearSearchButton, { color: themeColors.primary }]} onPress={handleClearSearch}>
                  Clear search
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Empty State (no spaces at all) */}
      {!loading && !error && spaces.length === 0 && (
        <EmptyState
          icon="people-outline"
          title="No spaces yet"
          message="Join a space to see it here"
        />
      )}
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

  // Search Bar
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },

  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
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
    fontSize: 16,
    padding: spacing.xs,
  },

  resultCount: {
    fontSize: typography.size.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  // Group Headers
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.sm + 2,
    marginTop: spacing.sm,
    borderBottomWidth: 1,
  },

  groupTitle: {
    fontSize: typography.size.md,
    fontWeight: '700',
    flex: 1,
  },

  groupCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },

  groupCountText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
  },

  // List
  listContent: {},

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
    fontWeight: '600',
    marginTop: spacing.md,
  },
});
