// =============================================================================
// FEED LIST - Scrollable list of feed cards
// =============================================================================
// Handles loading, empty, and error states. Includes pull-to-refresh.
//
// Usage:
//   <FeedList 
//     feeds={feeds}
//     loading={loading}
//     error={error}
//     onRefresh={refetch}
//     onFeedPress={(feed) => navigate('feed', { id: feed.id })}
//   />
// =============================================================================

import { EmptyState, ErrorMessage, LoadingSpinner } from '@/components/common';
import { colors } from '@/constants/colors';
import { screen, spacing } from '@/constants/layout';
import { Feed } from '@/types';
import React from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { FeedCard } from './FeedCard';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface FeedListProps {
  // Array of feeds to display
  feeds: Feed[];
  
  // Loading state (initial load)
  loading?: boolean;
  
  // Refreshing state (pull to refresh)
  refreshing?: boolean;
  
  // Error message
  error?: string | null;
  
  // Callbacks
  onRefresh?: () => void;
  onFeedPress?: (feed: Feed) => void;
  onReact?: (feedId: number, type: 'like' | 'love') => void;
  onAuthorPress?: (username: string) => void;
  onSpacePress?: (spaceSlug: string) => void;
  onLoadMore?: () => void;
  
  // Custom empty state
  emptyMessage?: string;
  emptyIcon?: string;
  
  // Header component (optional)
  ListHeaderComponent?: React.ReactElement;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function FeedList({
  feeds,
  loading = false,
  refreshing = false,
  error = null,
  onRefresh,
  onFeedPress,
  onReact,
  onAuthorPress,
  onSpacePress,
  onLoadMore,
  emptyMessage = 'No posts yet',
  emptyIcon = '📭',
  ListHeaderComponent,
}: FeedListProps) {
  
  // Initial loading state
  if (loading && feeds.length === 0) {
    return <LoadingSpinner message="Loading feed..." />;
  }
  
  // Error state
  if (error && feeds.length === 0) {
    return (
      <ErrorMessage 
        message={error} 
        onRetry={onRefresh}
      />
    );
  }
  
  // Empty state
  if (!loading && feeds.length === 0) {
    return (
      <View style={styles.container}>
        {ListHeaderComponent}
        <EmptyState 
          icon={emptyIcon}
          message={emptyMessage}
        />
      </View>
    );
  }
  
  // Render feed item
  const renderItem = ({ item }: { item: Feed }) => (
    <FeedCard
      feed={item}
      onPress={() => onFeedPress?.(item)}
      onReact={(type) => onReact?.(item.id, type)}
      onAuthorPress={() => {
        if (item.xprofile?.username) {
          onAuthorPress?.(item.xprofile.username);
        }
      }}
      onSpacePress={() => {
        if (item.space?.slug) {
          onSpacePress?.(item.space.slug);
        }
      }}
    />
  );
  
  return (
    <FlatList
      data={feeds}
      renderItem={renderItem}
      keyExtractor={(item) => item.id.toString()}
      style={styles.list}
      contentContainerStyle={styles.content}
      
      // Pull to refresh
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        ) : undefined
      }
      
      // Load more when reaching end
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      
      // Header
      ListHeaderComponent={ListHeaderComponent}
      
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={10}
      windowSize={10}
      
      // Item spacing
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
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
  
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  content: {
    paddingVertical: spacing.sm,
    // Add extra bottom padding for Android to avoid system navigation bar overlap
    paddingBottom: Platform.OS === 'android' 
      ? spacing.sm + screen.bottomSafeArea 
      : spacing.sm,
  },
  
  separator: {
    height: spacing.xs,
  },
});

export default FeedList;
