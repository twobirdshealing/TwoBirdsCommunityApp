// =============================================================================
// FEED LIST - High-performance scrollable list of feed cards
// =============================================================================
// Uses FlashList for better performance with complex feed items.
// IMPORTANT: Do NOT enable pagingEnabled - causes scroll snapping issues.
// =============================================================================

import { EmptyState, ErrorMessage, LoadingSpinner } from '@/components/common';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/layout';
import { Feed } from '@/types';
import React from 'react';
import { Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { FeedCard } from './FeedCard';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface FeedListProps {
  feeds: Feed[];
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onFeedPress?: (feed: Feed) => void;
  onReact?: (feedId: number, type: 'like' | 'love') => void;
  onAuthorPress?: (username: string) => void;
  onSpacePress?: (spaceSlug: string) => void;
  onLoadMore?: () => void;
  emptyMessage?: string;
  emptyIcon?: string;
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
    <View style={styles.container}>
      <FlashList
        data={feeds}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        
        // Performance: Estimate average card height
        // Adjust based on your actual card sizes
        estimatedItemSize={400}
        
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
        
        // Infinite scroll
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        
        // Header
        ListHeaderComponent={ListHeaderComponent}
        
        // Content padding
        contentContainerStyle={styles.content}
        
        // Item spacing
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        
        // Smooth scrolling (important: do NOT set pagingEnabled or snapTo*)
        showsVerticalScrollIndicator={true}
        
        // Scroll performance
        removeClippedSubviews={Platform.OS === 'android'}
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
  
  content: {
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'android' ? 100 : spacing.lg,
  },
  
  separator: {
    height: spacing.xs,
  },
});

export default FeedList;
