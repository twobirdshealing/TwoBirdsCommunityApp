// =============================================================================
// HOME SCREEN - Main feed view
// =============================================================================
// The first screen users see. Shows all community posts.
// Uses the new FeedList component and API service.
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { APP_NAME } from '@/constants/config';
import { Feed } from '@/types';
import { feedsApi } from '@/services/api';
import { FeedList } from '@/components/feed';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function HomeScreen() {
  // Navigation
  const router = useRouter();
  
  // State
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // -----------------------------------------------------------------------------
  // Fetch Feeds
  // -----------------------------------------------------------------------------
  
  const fetchFeeds = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }
      
      // Call the API service
      const response = await feedsApi.getFeeds({ per_page: 20 });
      
      if (response.success) {
        setFeeds(response.data.feeds.data);
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
  
  // Initial load
  useEffect(() => {
    fetchFeeds();
  }, [fetchFeeds]);
  
  // -----------------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------------
  
  const handleRefresh = () => {
    fetchFeeds(true);
  };
  
  const handleFeedPress = (feed: Feed) => {
    // Navigate to feed detail screen
    // TODO: Implement in Phase 1
    console.log('Navigate to feed:', feed.id);
    // router.push(`/feed/${feed.id}`);
  };
  
  const handleReact = async (feedId: number, type: 'like' | 'love') => {
    try {
      const response = await feedsApi.reactToFeed(feedId, type);
      
      if (response.success) {
        // Update the local state optimistically
        setFeeds(prevFeeds => 
          prevFeeds.map(feed => {
            if (feed.id === feedId) {
              const currentCount = typeof feed.reactions_count === 'string'
                ? parseInt(feed.reactions_count, 10)
                : feed.reactions_count || 0;
              
              const newCount = response.data.data.action === 'added'
                ? currentCount + 1
                : Math.max(0, currentCount - 1);
              
              return { ...feed, reactions_count: newCount };
            }
            return feed;
          })
        );
      }
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };
  
  const handleAuthorPress = (username: string) => {
    // Navigate to profile screen
    // TODO: Implement in Phase 1
    console.log('Navigate to profile:', username);
    // router.push(`/profile/${username}`);
  };
  
  const handleSpacePress = (spaceSlug: string) => {
    // Navigate to space screen
    // TODO: Implement in Phase 1
    console.log('Navigate to space:', spaceSlug);
    // router.push(`/space/${spaceSlug}`);
  };
  
  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{APP_NAME}</Text>
      </View>
      
      {/* Feed List */}
      <FeedList
        feeds={feeds}
        loading={loading}
        refreshing={refreshing}
        error={error}
        onRefresh={handleRefresh}
        onFeedPress={handleFeedPress}
        onReact={handleReact}
        onAuthorPress={handleAuthorPress}
        onSpacePress={handleSpacePress}
        emptyMessage="No posts yet. Be the first to share!"
        emptyIcon="🐦"
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
    backgroundColor: colors.primary,
    paddingTop: 60, // Status bar + padding
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textInverse,
  },
});
