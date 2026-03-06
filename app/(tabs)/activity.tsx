// =============================================================================
// ACTIVITY SCREEN - Main community feed with all features
// =============================================================================
// UPDATED: Added pin support for admins
// =============================================================================

import React, { useCallback } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Feed } from '@/types/feed';
import { feedsApi } from '@/services/api/feeds';
import { FeedList } from '@/components/feed/FeedList';
import { QuickPostBox } from '@/components/composer/QuickPostBox';
import { useAuth } from '@/contexts/AuthContext';
import { useTabBar } from '@/contexts/TabBarContext';
import { createLogger } from '@/utils/logger';

const log = createLogger('Activity');
import { useFeedReactions } from '@/hooks/useFeedReactions';
import { useCachedData } from '@/hooks/useCachedData';
import { useFeedActions } from '@/hooks/useFeedActions';
import { optimisticUpdate } from '@/utils/optimisticUpdate';
import { TabActivityWrapper } from '@/components/common/TabActivityWrapper';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ActivityScreen() {
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const { handleScroll } = useTabBar();

  // ---------------------------------------------------------------------------
  // Fetch Feeds (cached + focus refresh, merges sticky posts at top)
  // ---------------------------------------------------------------------------

  const {
    data: feedsData,
    isLoading: loading,
    isRefreshing: refreshing,
    error: fetchError,
    refresh,
    mutate,
  } = useCachedData<Feed[]>({
    cacheKey: 'tbc_activity_feeds',
    invalidateOn: 'feeds',
    fetcher: async () => {
      const response = await feedsApi.getFeeds({ per_page: 20 });

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to load feeds');
      }

      // BULLETPROOF: sticky can be null, undefined, object, or array
      let stickyPosts: Feed[] = [];
      const rawSticky = response.data.sticky;

      if (rawSticky) {
        if (Array.isArray(rawSticky)) {
          stickyPosts = rawSticky;
        } else if (typeof rawSticky === 'object') {
          if (Array.isArray((rawSticky as any).data)) {
            stickyPosts = (rawSticky as any).data;
          } else if ((rawSticky as any).id) {
            stickyPosts = [rawSticky as Feed];
          } else {
            const values = Object.values(rawSticky);
            if (values.length > 0 && (values[0] as any)?.id) {
              stickyPosts = values as Feed[];
            }
          }
        }
      }

      // BULLETPROOF: feeds.data can also be missing
      let regularFeeds: Feed[] = [];
      if (response.data.feeds?.data && Array.isArray(response.data.feeds.data)) {
        regularFeeds = response.data.feeds.data;
      }

      // Remove duplicates (sticky might also appear in regular feeds)
      const stickyIds = new Set(stickyPosts.map(f => f.id));
      const filteredRegular = regularFeeds.filter(f => !stickyIds.has(f.id));

      // Ensure sticky posts are marked
      const markedSticky = stickyPosts.map(f => ({ ...f, is_sticky: true }));

      return [...markedSticky, ...filteredRegular];
    },
  });

  const feeds = feedsData || [];
  const error = fetchError?.message || null;

  // Adapter: wraps mutate to match React.Dispatch<SetStateAction<Feed[]>> signature
  const setFeeds: React.Dispatch<React.SetStateAction<Feed[]>> = useCallback(
    (action) => {
      mutate(prev => {
        const current = prev || [];
        return typeof action === 'function' ? action(current) : action;
      });
    },
    [mutate],
  );
  
  // Shared feed actions (navigation to composer/comments, bookmark, delete)
  const {
    handleCommentPress, openComposer, handleEdit,
    handleBookmarkToggle, handleDelete,
    handleAuthorPress, handleSpacePress,
  } = useFeedActions({ setFeeds, refresh });

  const handleReact = useFeedReactions(feeds, setFeeds);

  // ---------------------------------------------------------------------------
  // Pin Handler (activity-specific: user must own the post)
  // ---------------------------------------------------------------------------

  const handlePin = async (feed: Feed) => {
    if (Number(feed.user_id) !== user?.id) {
      Alert.alert('Cannot Pin', 'You can only pin your own posts from this view. Go to the space to pin other posts.');
      return;
    }

    const newStickyState = !feed.is_sticky;
    try {
      const response = await optimisticUpdate(
        setFeeds,
        prev => prev.map(f => f.id === feed.id ? { ...f, is_sticky: newStickyState } : f),
        () => feedsApi.toggleSticky(feed.id, newStickyState),
      );
      if (response.success) {
        Alert.alert(
          newStickyState ? 'Pinned' : 'Unpinned',
          newStickyState ? 'Post pinned to top!' : 'Post unpinned'
        );
        refresh();
      } else {
        Alert.alert('Error', response.error?.message || 'Failed to update pin status');
      }
    } catch (err) {
      log.error('Pin error:', err);
      Alert.alert('Error', 'Failed to update pin status');
    }
  };

  // ---------------------------------------------------------------------------
  // Header Component
  // ---------------------------------------------------------------------------

  const FeedHeader = () => (
    <QuickPostBox onPress={openComposer} />
  );
  
  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
  return (
    <TabActivityWrapper>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <FeedList
          feeds={feeds}
          loading={loading}
          refreshing={refreshing}
          error={error}
          onRefresh={refresh}
          onReact={handleReact}
          onAuthorPress={handleAuthorPress}
          onSpacePress={handleSpacePress}
          onCommentPress={handleCommentPress}
          onBookmarkToggle={handleBookmarkToggle}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onPin={handlePin}
          onScroll={handleScroll}
          ListHeaderComponent={<FeedHeader />}
        />
      </View>
    </TabActivityWrapper>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
