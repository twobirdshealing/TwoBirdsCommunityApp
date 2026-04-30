// =============================================================================
// FEED LIST - Scrollable list of feed cards with all features
// =============================================================================
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { useTheme } from '@/contexts/ThemeContext';
import { useTabContentPadding } from '@/contexts/BottomOffsetContext';
import { spacing } from '@/constants/layout';
import { Feed, ReactionType } from '@/types/feed';
import React from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { FeedCard } from './FeedCard';
import { FeedModalsProvider } from '@/contexts/FeedModalsContext';

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
  /** State updater for module slots to perform optimistic updates directly */
  setFeeds?: React.Dispatch<React.SetStateAction<Feed[]>>;
  onAuthorPress?: (username: string) => void;
  onSpacePress?: (spaceSlug: string) => void;
  onCommentPress?: (feed: Feed) => void;
  onBookmarkToggle?: (feed: Feed, isBookmarked: boolean) => void;
  onEdit?: (feed: Feed) => void;
  onDelete?: (feed: Feed) => void;
  onPin?: (feed: Feed) => void;  // Pin callback
  onPinToSidebar?: (feed: Feed) => void;  // Sidebar (Featured Posts) pin callback — same admin/mod gate
  canModerate?: boolean; // If true, shows Edit/Delete for any post (admin/mod)
  onLoadMore?: () => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
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
  setFeeds,
  onAuthorPress,
  onSpacePress,
  onCommentPress,
  onBookmarkToggle,
  onEdit,
  onDelete,
  onPin,
  onPinToSidebar,
  canModerate = false,
  onLoadMore,
  onScroll,
  emptyMessage = 'No posts yet',
  emptyIcon = 'mail-open-outline',
  ListHeaderComponent,
}: FeedListProps) {
  const { colors: themeColors } = useTheme();
  const bottomPadding = useTabContentPadding();

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

  // Render feed item — callbacks passed directly (no inline wrappers)
  // so React.memo on FeedCard can skip re-renders when feed data hasn't changed.
  const renderItem = ({ item }: { item: Feed }) => (
    <FeedCard
      feed={item}
      onReact={onReact}
      setFeeds={setFeeds}
      onAuthorPress={onAuthorPress}
      onSpacePress={onSpacePress}
      onCommentPress={onCommentPress}
      onBookmarkToggle={onBookmarkToggle}
      onEdit={onEdit}
      onDelete={onDelete}
      onPin={onPin}
      onPinToSidebar={onPinToSidebar}
      canModerate={canModerate}
    />
  );

  return (
    <FeedModalsProvider>
      <FlashList
        data={feeds}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: bottomPadding }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeaderComponent}
        onScroll={onScroll}
        scrollEventThrottle={16}
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
      />
    </FeedModalsProvider>
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
  },
});

export default FeedList;
