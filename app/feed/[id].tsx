// =============================================================================
// FEED DETAIL SCREEN - Full-screen swipeable post viewer
// =============================================================================
// Route: /feed/{id}?space={slug}&context={space|home|profile}
// Full-screen modal - NO bottom tabs, HAS top nav with back button
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

  const handleReact = async (feedId: number, type: 'like' | 'love') => {
    try {
      const response = await feedsApi.reactToFeed(feedId, type);
      
      if (response.success) {
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

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

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
        {/* CRITICAL: Stack.Screen for top nav */}
        <Stack.Screen 
          options={{ 
            headerShown: true,
            title: pageTitle,
            headerBackTitle: 'Back',
          }} 
        />
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={colors.textInverse} />
      </View>
    );
  }

  if (error || feeds.length === 0) {
    return (
      <View style={styles.errorContainer}>
        {/* CRITICAL: Stack.Screen for top nav */}
        <Stack.Screen 
          options={{ 
            headerShown: true,
            title: pageTitle,
            headerBackTitle: 'Back',
          }} 
        />
        <StatusBar barStyle="light-content" />
        <Text style={styles.errorText}>{error || 'Post not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* CRITICAL: Stack.Screen for top nav with title */}
      <Stack.Screen 
        options={{ 
          headerShown: true,
          title: pageTitle,
          headerBackTitle: 'Back',
        }} 
      />
      <StatusBar barStyle="light-content" />
      
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
              bottomInset={insets.bottom}
            />
          </View>
        )}
        pagingEnabled
        horizontal={false}
        showsVerticalScrollIndicator={false}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        snapToInterval={SCREEN_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        windowSize={5}
      />
      
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
