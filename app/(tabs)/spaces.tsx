// =============================================================================
// MAIN SPACES SCREEN - Shows all spaces user is a member of
// =============================================================================
// Note: API pagination doesn't work - returns all spaces at once
// Implements client-side search filtering
// =============================================================================

import { FlashList } from '@shopify/flash-list';
import { Stack, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { 
  ActivityIndicator,
  RefreshControl, 
  StyleSheet, 
  Text,
  TextInput, 
  View 
} from 'react-native';

import { SpaceCard } from '@/components/space/SpaceCard';
import { spacesApi } from '@/services/api/spaces';
import { Space } from '@/types';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';

export default function SpacesScreen() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ---------------------------------------------------------------------------
  // Fetch All Spaces (API doesn't support pagination)
  // ---------------------------------------------------------------------------

  const fetchSpaces = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const response = await spacesApi.getSpaces({
        status: 'published',
      });

      if (!response.success) {
        setError(response.error?.message || 'Failed to load spaces');
        return;
      }

      const apiData = response.data as any;
      const spacesList = apiData?.spaces || [];
      
      setSpaces(spacesList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, []);

  // ---------------------------------------------------------------------------
  // Client-side Search Filter
  // ---------------------------------------------------------------------------

  const filteredSpaces = useMemo(() => {
    if (!searchQuery.trim()) {
      return spaces;
    }

    const query = searchQuery.toLowerCase().trim();
    return spaces.filter(space => 
      space.title?.toLowerCase().includes(query) ||
      space.description?.toLowerCase().includes(query) ||
      space.slug?.toLowerCase().includes(query)
    );
  }, [spaces, searchQuery]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    fetchSpaces(true);
  };

  const handleSpacePress = (space: Space) => {
    router.push(`/space/${space.slug}`);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Spaces',
          headerShown: true,
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTitleStyle: {
            fontSize: typography.size.lg,
            fontWeight: '600',
          },
        }}
      />

      <View style={styles.container}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search spaces..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Text style={styles.clearButton} onPress={handleClearSearch}>
                ✕
              </Text>
            )}
          </View>
          
          {/* Result count when searching */}
          {searchQuery.length > 0 && (
            <Text style={styles.resultCount}>
              {filteredSpaces.length} of {spaces.length} spaces
            </Text>
          )}
        </View>

        {/* Error State */}
        {error && !loading && spaces.length === 0 && (
          <View style={styles.centerContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.retryButton} onPress={handleRefresh}>
              Tap to retry
            </Text>
          </View>
        )}

        {/* Loading State */}
        {loading && spaces.length === 0 && (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading spaces...</Text>
          </View>
        )}

        {/* Spaces List */}
        {!loading && spaces.length > 0 && (
          <FlashList
            data={filteredSpaces}
            renderItem={({ item }) => (
              <SpaceCard space={item} onPress={() => handleSpacePress(item)} />
            )}
            estimatedItemSize={140}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={handleRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            }
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              searchQuery.length > 0 ? (
                <View style={styles.centerContainer}>
                  <Text style={styles.emptyIcon}>🔍</Text>
                  <Text style={styles.emptyText}>
                    No spaces match "{searchQuery}"
                  </Text>
                  <Text style={styles.clearSearchButton} onPress={handleClearSearch}>
                    Clear search
                  </Text>
                </View>
              ) : (
                <View style={styles.centerContainer}>
                  <Text style={styles.emptyIcon}>👥</Text>
                  <Text style={styles.emptyText}>No spaces found</Text>
                </View>
              )
            }
          />
        )}

        {/* Empty State (no spaces at all) */}
        {!loading && !error && spaces.length === 0 && (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyText}>You're not a member of any spaces yet</Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  searchContainer: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
  },

  searchIcon: {
    fontSize: 16,
    marginRight: spacing.xs,
  },

  searchInput: {
    flex: 1,
    height: 40,
    fontSize: typography.size.md,
    color: colors.text,
  },

  clearButton: {
    fontSize: 16,
    color: colors.textTertiary,
    padding: spacing.xs,
  },

  resultCount: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },

  listContent: {
    paddingVertical: spacing.xs,
  },

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.size.md,
    color: colors.textSecondary,
  },

  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  errorText: {
    fontSize: typography.size.md,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.md,
  },

  retryButton: {
    fontSize: typography.size.md,
    color: colors.primary,
    fontWeight: '600',
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },

  emptyText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  clearSearchButton: {
    fontSize: typography.size.md,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.md,
  },
});
