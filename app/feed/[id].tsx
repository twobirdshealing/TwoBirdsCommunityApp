// =============================================================================
// FEED DETAIL SCREEN - Full-screen swipeable post viewer
// =============================================================================
// Route: /feed/{id}?space={slug}&context={space|home|profile}
// Full-screen modal - NO bottom tabs, HAS top nav with back button
// UPDATED: CommentSheet opens when tapping comment icon on FullScreenPost
// =============================================================================

import React, { useEffect, useState, useRef } from 'react';
import { 
  FlatList,
  StyleSheet, 
  View,
  StatusBar,
  ActivityIndicator,
  Text,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/constants/colors';
import { Feed } from '@/types';
import { feedsApi } from '@/services/api';
import { FullScreenPost } from '@/components/feed/FullScreenPost';
import { CommentSheet } from '@/components/feed/CommentSheet';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function FeedDetailScreen() {
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  
  const router = useRouter();
  const { id, space, context } = useLocalSearchParams<{ 
    id: string;
    space?: string;
    context?: 'space' | 'home' | 'profile';
  }>();
  const flatListRef = useRef<FlatList>(null);
  
  // State
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState('Post');
  
  // Comment sheet state
  const [showComments, setShowComments] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch feeds based on context
  // ---------------------------------------------------------------------------
  
  useEffect(() => {
    fetchFeeds();
  }, [id, space, context]);

  const fetchFeeds = async () => {
    try {
      setLoading(true);
      
      // Build API params based on context
      const params: any = { per_page: 50 };
      
      if (space) {
        params.space = space;
        setPageTitle(decodeURIComponent(space).split('-').map(w => 
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' '));
      } else if (context === 'profile') {
        setPageTitle('Posts');
      } else {
        setPageTitle('Feed');
      }
      
      const response = await feedsApi.getFeeds(params);
      
      if (response.success && response.data.feeds.data) {
        const allFeeds = response.data.feeds.data;
        setFeeds(allFeeds);
        
        const tappedIndex = allFeeds.findIndex(
          (feed) => feed.id.toString() === id
        );
        
        if (tappedIndex !== -1) {
          setCurrentIndex(tappedIndex);
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: tappedIndex,
              animated: false,
            });
          }, 100);
        }
      } else {
        setError('Failed to load posts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleClose = () => {
    router.back();
  };

  const handleReact = async (feedId: number, type: 'like') => {
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return;
    
    const hasUserReact = feed.has_user_react || false;

    try {
      const response = await feedsApi.reactToFeed(feedId, type, hasUserReact);
      
      if (response.success) {
        setFeeds(prevFeeds =>
          prevFeeds.map(f => {
            if (f.id === feedId) {
              const currentCount = typeof f.reactions_count === 'string'
                ? parseInt(f.reactions_count, 10)
                : f.reactions_count || 0;
              
              return {
                ...f,
                has_user_react: !hasUserReact,
                reactions_count: hasUserReact ? currentCount - 1 : currentCount + 1,
              };
            }
            return f;
          })
        );
      }
    } catch (err) {
      console.error('Failed to react:', err);
    }
  };

  // Open comment sheet for specific feed
  const handleCommentPress = (feedId: number) => {
    setSelectedFeedId(feedId);
    setShowComments(true);
  };

  const handleCloseComments = () => {
    setShowComments(false);
    setSelectedFeedId(null);
  };

  const handleCommentAdded = () => {
    // Refresh to update comment count
    fetchFeeds();
  };

  const handleAuthorPress = (username: string) => {
    router.push(`/profile/${username}`);
  };

  // ---------------------------------------------------------------------------
  // Render item
  // ---------------------------------------------------------------------------

  const renderItem = ({ item, index }: { item: Feed; index: number }) => (
    <FullScreenPost
      feed={item}
      isActive={index === currentIndex}
      onClose={handleClose}
      onReact={(type) => handleReact(item.id, type)}
      onCommentPress={() => handleCommentPress(item.id)}
      onAuthorPress={() => handleAuthorPress(item.xprofile?.username || '')}
      bottomInset={insets.bottom}
    />
  );

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error || feeds.length === 0) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="light-content" />
        <Text style={styles.errorText}>{error || 'No posts found'}</Text>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: pageTitle,
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerBackTitle: 'Back',
        }} 
      />
      <StatusBar barStyle="light-content" />
      
      <FlatList
        ref={flatListRef}
        data={feeds}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        pagingEnabled
        horizontal={false}
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        snapToInterval={SCREEN_HEIGHT}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: info.index,
              animated: false,
            });
          }, 500);
        }}
        onMomentumScrollEnd={(event) => {
          const index = Math.round(
            event.nativeEvent.contentOffset.y / SCREEN_HEIGHT
          );
          setCurrentIndex(index);
        }}
      />

      {/* Comment Sheet */}
      <CommentSheet
        visible={showComments}
        feedId={selectedFeedId}
        onClose={handleCloseComments}
        onCommentAdded={handleCommentAdded}
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
    backgroundColor: '#000',
  },
  
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  errorText: {
    color: '#fff',
    fontSize: 16,
  },
});
