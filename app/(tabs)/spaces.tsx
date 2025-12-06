// =============================================================================
// SPACES SCREEN - List of community spaces/groups
// =============================================================================
// Shows all spaces the user can view or join.
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { Space } from '@/types';
import { spacesApi } from '@/services/api';
import { SpaceCard } from '@/components/space';
import { LoadingSpinner, ErrorMessage, EmptyState } from '@/components/common';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function SpacesScreen() {
  const router = useRouter();
  
  // State
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // -----------------------------------------------------------------------------
  // Fetch Spaces
  // -----------------------------------------------------------------------------
  
  const fetchSpaces = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }
      
      const response = await spacesApi.getSpaces({ per_page: 50 });
      
      if (response.success) {
        setSpaces(response.data.spaces);
      } else {
        setError(response.error.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    fetchSpaces();
  }, [fetchSpaces]);
  
  // -----------------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------------
  
  const handleRefresh = () => {
    fetchSpaces(true);
  };
  
  const handleSpacePress = (space: Space) => {
    // Navigate to space detail
    console.log('Navigate to space:', space.slug);
    // router.push(`/space/${space.slug}`);
  };
  
  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------
  
  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Spaces</Text>
        </View>
        <LoadingSpinner message="Loading spaces..." />
      </View>
    );
  }
  
  // Error state
  if (error && spaces.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Spaces</Text>
        </View>
        <ErrorMessage message={error} onRetry={handleRefresh} />
      </View>
    );
  }
  
  // Empty state
  if (spaces.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Spaces</Text>
        </View>
        <EmptyState 
          icon="👥"
          title="No Spaces"
          message="There are no spaces to show right now."
        />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Spaces</Text>
        <Text style={styles.headerSubtitle}>
          {spaces.length} {spaces.length === 1 ? 'space' : 'spaces'}
        </Text>
      </View>
      
      {/* Spaces List */}
      <FlatList
        data={spaces}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <SpaceCard 
            space={item} 
            onPress={() => handleSpacePress(item)}
            variant="list"
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
  
  header: {
    backgroundColor: colors.surface,
    paddingTop: 60,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  
  headerTitle: {
    fontSize: typography.size.xxl,
    fontWeight: typography.weight.bold,
    color: colors.text,
  },
  
  headerSubtitle: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  
  list: {
    paddingVertical: spacing.sm,
  },
  
  separator: {
    height: spacing.xs,
  },
});
