// =============================================================================
// MAIN SPACES SCREEN - Shows spaces organized by group
// =============================================================================
// Fetches space groups (options_only) and user's spaces (profile endpoint)
// to display grouped spaces with member counts and role badges.
// =============================================================================

import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';

import { SpaceCard } from '@/components/space/SpaceCard';
import { spacing, typography } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { profilesApi } from '@/services/api/profiles';
import { spacesApi } from '@/services/api/spaces';
import { Space, SpaceGroupOption } from '@/types';

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
  const { user } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [groups, setGroups] = useState<SpaceGroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ---------------------------------------------------------------------------
  // Fetch Groups + Spaces in parallel
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      // Fetch groups and spaces in parallel
      const [groupsRes, spacesRes] = await Promise.all([
        spacesApi.getSpaceGroups({ options_only: true }),
        user?.username
          ? profilesApi.getUserSpaces(user.username)
          : spacesApi.getSpaces({ status: 'published' }),
      ]);

      // Process groups
      if (groupsRes.success && groupsRes.data) {
        const groupsData = groupsRes.data as any;
        setGroups(groupsData?.groups || []);
      }

      // Process spaces
      if (spacesRes.success && spacesRes.data) {
        const spacesData = spacesRes.data as any;
        const spacesList = spacesData?.spaces || [];
        setSpaces(spacesList);
      } else {
        setError(spacesRes.error?.message || 'Failed to load spaces');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.username]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleRefresh = () => fetchData(true);

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
          <Text style={styles.searchIcon}>🔍</Text>
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
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
          <Text style={[styles.retryButton, { color: themeColors.primary }]} onPress={handleRefresh}>
            Tap to retry
          </Text>
        </View>
      )}

      {/* Loading State */}
      {loading && spaces.length === 0 && (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
          <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading spaces...</Text>
        </View>
      )}

      {/* Grouped Spaces List */}
      {!loading && listData.length > 0 && (
        <FlashList
          data={listData}
          renderItem={renderItem}
          getItemType={getItemType}
          estimatedItemSize={180}
          keyExtractor={(item) =>
            item._type === 'group_header'
              ? `group-${item.id}`
              : `space-${item.space.id}`
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={themeColors.primary}
              colors={[themeColors.primary]}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            searchQuery.length > 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔍</Text>
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
        <View style={styles.centerContainer}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>No spaces yet</Text>
          <Text style={[styles.emptySubtext, { color: themeColors.textTertiary }]}>
            Join a space to see it here
          </Text>
        </View>
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
    fontSize: 16,
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
  listContent: {
    paddingBottom: 100, // Space for tab bar
  },

  // States
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.md,
  },

  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  errorText: {
    fontSize: typography.size.md,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },

  retryButton: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xxl,
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  emptyText: {
    fontSize: typography.size.md,
    textAlign: 'center',
  },

  emptySubtext: {
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
  },

  clearSearchButton: {
    fontSize: typography.size.md,
    fontWeight: '600',
    marginTop: spacing.md,
  },
});
