// =============================================================================
// FEED DETAIL SCREEN - Full-screen swipeable post viewer
// =============================================================================
// Route: /feed/{id}?space={slug}&context={space|home|profile}
// Shows full-screen content with swipe navigation.
// Supports different feed contexts (home, space, profile)
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/constants/colors';
import { Feed } from '@/types';
import { feedsApi } from '@/services/api';
import { FullScreenPost } from '@/components/feed/FullScreenPost';
import { CommentSheet } from '@/components/feed/CommentSheet';

// Heights for UI elements
const HEADER_HEIGHT = 0;
const FOOTER_HEIGHT = 0;
const ACTIONS_WIDTH = 80;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function FeedDetailScreen() {
  // Use dynamic dimensions - updates on rotation/resize
  const { height: SCREEN_HEIGHT } = useWindowDimensions();
  
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
        // Space context: Load feeds from this space
        params.space = space;
      } else if (context === 'profile') {
        // Profile context: Load user's feeds
        // TODO: Add user_id param when available
      }
      // else: Load main feed
      
      const response = await feedsApi.getFeeds(params);
      
      if (response.success && response.data.feeds.data) {
        const allFeeds = response.data.feeds.data;
        setFeeds(allFeeds);
        
        // Find the index of the tapped post
        const tappedIndex = allFeeds.findIndex(
          (feed) => feed.id.toString() === id
        );
        
        if (tappedIndex !== -1) {
          setCurrentIndex(tappedIndex);
          // Scroll to the tapped post after a short delay
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

  const handleReact = async (feedId: number, type: 'like' | 'love') => {
    try {
      const response = await feedsApi.reactToFeed(feedId, type);
      
      if (response.success) {
        // Update local state
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

  const handleOpenComments = (feedId: number) => {
    setSelectedFeedId(feedId);
    setShowComments(true);
  };

  const handleCloseComments = () => {
    setShowComments(false);
    setSelectedFeedId(null);
  };

  const handleAuthorPress = (username: string) => {
    router.push(`/profile/${username}`);
  };

  // Track which post is currently visible
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // ---------------------------------------------------------------------------
  // Item layout calculator - must use current SCREEN_HEIGHT
  // ---------------------------------------------------------------------------
  
  const getItemLayout = (_data: any, index: number) => ({
    length: SCREEN_HEIGHT,
    offset: SCREEN_HEIGHT * index,
    index,
  });

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={colors.textInverse} />
      </View>
    );
  }

  if (error || feeds.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.errorText}>{error || 'Post not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Swipeable Full-Screen Posts */}
      <FlatList
        ref={flatListRef}
        data={feeds}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item, index }) => (
          <View style={{ height: SCREEN_HEIGHT }}>
            <FullScreenPost
              feed={item}
              isActive={index === currentIndex}
              onClose={handleClose}
              onReact={(type) => handleReact(item.id, type)}
              onCommentPress={() => handleOpenComments(item.id)}
              onAuthorPress={() => {
                if (item.xprofile?.username) {
                  handleAuthorPress(item.xprofile.username);
                }
              }}
            />
          </View>
        )}
        
        // Vertical paging (swipe up/down)
        pagingEnabled
        horizontal={false}
        showsVerticalScrollIndicator={false}
        
        // Each item is full screen height
        getItemLayout={getItemLayout}
        
        // Track current post
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        
        // Snap behavior - prevents drift
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        
        // Disable scroll bounce at edges
        bounces={false}
        
        // Prefetch nearby posts
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
      />
      
      {/* Comment Sheet */}
      {selectedFeedId && (
        <CommentSheet
          feedId={selectedFeedId}
          visible={showComments}
          onClose={handleCloseComments}
        />
      )}
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
  
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  errorContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  errorText: {
    color: colors.textInverse,
    fontSize: 16,
    textAlign: 'center',
  },
});
