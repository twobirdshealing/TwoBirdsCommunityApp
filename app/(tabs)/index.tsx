// =============================================================================
// HOME SCREEN - Main feed view
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
  const router = useRouter();
  
  // State
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ---------------------------------------------------------------------------
  // Fetch Feeds
  // ---------------------------------------------------------------------------
  
  const fetchFeeds = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
        setError(null);
      }
      
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
  
  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  
  const handleRefresh = () => {
    fetchFeeds(true);
  };
  
  const handleFeedPress = (feed: Feed) => {
    router.push(`/feed/${feed.id}`);
  };
  
  const handleReact = async (feedId: number, type: 'like' | 'love') => {
    // Find the feed to check current reaction state
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return;
    
    const hasUserReact = feed.has_user_react || false;
    
    // Optimistic update
    setFeeds(prevFeeds => 
      prevFeeds.map(f => {
        if (f.id === feedId) {
          const currentCount = typeof f.reactions_count === 'string'
            ? parseInt(f.reactions_count, 10)
            : f.reactions_count || 0;
          
          return {
            ...f,
            has_user_react: !hasUserReact,
            reactions_count: hasUserReact ? currentCount - 1 : currentCount + 1
          };
        }
        return f;
      })
    );
    
    try {
      // Call API with proper parameters
      const response = await feedsApi.reactToFeed(feedId, type, hasUserReact);
      
      if (response.success) {
        // Update with server's actual count
        setFeeds(prevFeeds => 
          prevFeeds.map(f => 
            f.id === feedId 
              ? { ...f, reactions_count: response.data.new_count }
              : f
          )
        );
      } else {
        // Revert on error
        setFeeds(prevFeeds => 
          prevFeeds.map(f => {
            if (f.id === feedId) {
              return { ...f, has_user_react: hasUserReact };
            }
            return f;
          })
        );
      }
    } catch (err) {
      console.error('Failed to react:', err);
      // Revert optimistic update
      fetchFeeds(true);
    }
  };
  
  const handleAuthorPress = (username: string) => {
    router.push(`/profile/${username}`);
  };
  
  const handleSpacePress = (spaceSlug: string) => {
    router.push(`/space/${spaceSlug}`);
  };
  
  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  
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
    paddingTop: 60,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  
  headerTitle: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
    color: colors.textInverse,
  },
});
