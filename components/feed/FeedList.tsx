// =============================================================================
// FEED LIST - Scrollable list of feed cards with comment support
// =============================================================================
// Uses FlatList for reliable cross-platform scrolling.
// UPDATED: Single like reaction type, comment support
// =============================================================================

import { EmptyState, ErrorMessage, LoadingSpinner } from '@/components/common';
import { colors } from '@/constants/colors';
import { spacing } from '@/constants/layout';
import { Feed } from '@/types';
import React from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View } from 'react-native';
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
  onReact?: (feedId: number, type: 'like') => void;
  onAuthorPress?: (username: string) => void;
  onSpacePress?: (spaceSlug: string) => void;
  onCommentPress?: (feed: Feed) => void;
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
  onCommentPress,
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
      onCommentPress={() => onCommentPress?.(item)}
    />
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={feeds}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeaderComponent}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          ) : undefined
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.5}
        // Performance optimizations
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={10}
        windowSize={10}
        initialNumToRender={10}
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
  
  list: {
    paddingVertical: spacing.sm,
    paddingBottom: 100, // Extra padding for bottom tabs
  },
});

export default FeedList;
