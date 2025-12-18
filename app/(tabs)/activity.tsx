// =============================================================================
// ACTIVITY SCREEN - Main community feed
// =============================================================================
// Shows all posts from spaces user is a member of
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Feed } from '@/types';
import { feedsApi } from '@/services/api';
import { FeedList } from '@/components/feed';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ActivityScreen() {
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
      const response = await feedsApi.reactToFeed(feedId, type, hasUserReact);
      
      if (response.success) {
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
      {/* TODO: Add QuickPostBox here */}
      {/* <QuickPostBox 
        placeholder="What's happening?"
        onPress={() => openComposer()}
      /> */}

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
});
