// =============================================================================
// MAIN SPACES SCREEN - Shows all spaces user is a member of
// =============================================================================
// DEBUG VERSION - Added extensive logging to trace 401 issue
// =============================================================================

import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
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
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { spacesApi } from '@/services/api/spaces';
import { Space } from '@/types';

export default function SpacesScreen() {
  const router = useRouter();
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

      console.log('[SPACES DEBUG] Starting fetchSpaces...');

      const response = await spacesApi.getSpaces({
        status: 'published',
      });

      // DEBUG: Log the FULL response
      console.log('[SPACES DEBUG] Full response:', JSON.stringify(response, null, 2).substring(0, 1500));
      console.log('[SPACES DEBUG] response.success:', response.success);

      if (!response.success) {
        console.log('[SPACES DEBUG] Response NOT successful');
        console.log('[SPACES DEBUG] Error:', response.error);
        setError(response.error?.message || 'Failed to load spaces');
        return;
      }

      const apiData = response.data as any;
      console.log('[SPACES DEBUG] apiData keys:', apiData ? Object.keys(apiData) : 'null');
      
      const spacesList = apiData?.spaces || [];
      console.log('[SPACES DEBUG] spacesList length:', spacesList.length);
      console.log('[SPACES DEBUG] spacesList type:', typeof spacesList);
      console.log('[SPACES DEBUG] Is array:', Array.isArray(spacesList));
      
      if (spacesList.length > 0) {
        console.log('[SPACES DEBUG] First space:', JSON.stringify(spacesList[0], null, 2).substring(0, 300));
      }
      
      setSpaces(spacesList);
    } catch (err) {
      console.log('[SPACES DEBUG] CAUGHT ERROR:', err);
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
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyText}>No spaces match "{searchQuery}"</Text>
                <Text style={styles.clearSearchButton} onPress={handleClearSearch}>
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
          <Text style={styles.emptyText}>No spaces yet</Text>
          <Text style={styles.emptySubtext}>
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
    backgroundColor: colors.background,
  },

  // Search Bar
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
    marginTop: spacing.sm,
    textAlign: 'center',
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
    marginBottom: spacing.sm,
  },

  retryButton: {
    fontSize: typography.size.md,
    color: colors.primary,
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
    color: colors.textSecondary,
    textAlign: 'center',
  },

  emptySubtext: {
    fontSize: typography.size.sm,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },

  clearSearchButton: {
    fontSize: typography.size.md,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.md,
  },
});