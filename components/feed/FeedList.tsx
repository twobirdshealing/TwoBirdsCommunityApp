// =============================================================================
// FEED LIST - Scrollable list of feed cards with all features
// =============================================================================
// UPDATED: Added onPin callback for pin functionality
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import { EmptyState, ErrorMessage, LoadingSpinner } from '@/components/common';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/constants/layout';
import { Feed, ReactionType } from '@/types';
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
  onReact?: (feedId: number, type: ReactionType) => void;
  onAuthorPress?: (username: string) => void;
  onSpacePress?: (spaceSlug: string) => void;
  onCommentPress?: (feed: Feed) => void;
  onBookmarkToggle?: (feed: Feed, isBookmarked: boolean) => void;
  onEdit?: (feed: Feed) => void;
  onDelete?: (feed: Feed) => void;
  onPin?: (feed: Feed) => void;  // Pin callback
  canModerate?: boolean; // If true, shows Edit/Delete for any post (admin/mod)
  onLoadMore?: () => void;
  emptyMessage?: string;
  emptyIcon?: keyof typeof Ionicons.glyphMap;
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
  onReact,
  onAuthorPress,
  onSpacePress,
  onCommentPress,
  onBookmarkToggle,
  onEdit,
  onDelete,
  onPin,
  canModerate = false,
  onLoadMore,
  emptyMessage = 'No posts yet',
  emptyIcon = 'mail-open-outline',
  ListHeaderComponent,
}: FeedListProps) {
  const { colors: themeColors } = useTheme();

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
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {ListHeaderComponent}
        <EmptyState
          icon={emptyIcon}
          message={emptyMessage}
        />
      </View>
    );
  }

  // Render feed item
  const renderItem = ({ item }: { item: Feed }) => {
    return (
      <FeedCard
        feed={item}
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
        onBookmarkToggle={(isBookmarked) => onBookmarkToggle?.(item, isBookmarked)}
        onEdit={() => onEdit?.(item)}
        onDelete={() => onDelete?.(item)}
        onPin={onPin ? () => onPin(item) : undefined}  // Only pass if parent provides it
        canModerate={canModerate}
      />
    );
  };

  return (
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
            colors={[themeColors.primary]}
            tintColor={themeColors.primary}
          />
        ) : undefined
      }
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      // Performance optimizations
      removeClippedSubviews={Platform.OS === 'android'}
      maxToRenderPerBatch={10}
      windowSize={10}
      initialNumToRender={5}
    />
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  list: {
    paddingVertical: spacing.sm,
    paddingBottom: 100,
  },
});

export default FeedList;
