// =============================================================================
// MAIN SPACES SCREEN - Shows all spaces user is a member of
// =============================================================================
// FIXED: Added top navigation header (was missing!)
// Uses GET /spaces endpoint with proper pagination
// =============================================================================

import { FlashList } from '@shopify/flash-list';
import { Stack, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';

import { SpaceCard } from '@/components/space/SpaceCard';
import { spacesApi } from '@/services/api/spaces';
import { Space } from '@/types';

export default function SpacesScreen() {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchSpaces = async (pageNum: number = 1, shouldAppend: boolean = false) => {
    if (loading) return;

    try {
      setLoading(true);

      const response = await spacesApi.getSpaces({
        page: pageNum,
        per_page: 20,
        status: 'published',
      });

      const newSpaces = response.data.spaces;

      if (shouldAppend) {
        setSpaces((prev) => [...prev, ...newSpaces]);
      } else {
        setSpaces(newSpaces);
      }

      setHasMore(newSpaces.length === 20);
    } catch (error) {
      console.error('Error fetching spaces:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces(1, false);
  }, []);

  const handleRefresh = () => {
    setPage(1);
    setHasMore(true);
    fetchSpaces(1, false);
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchSpaces(nextPage, true);
    }
  };

  const handleSpacePress = (space: Space) => {
    router.push(`/space/${space.slug}`);
  };

  return (
    <>
      {/* ✅ TOP NAVIGATION - This was missing! */}
      <Stack.Screen
        options={{
          title: 'Spaces',
          headerShown: true,
          headerStyle: {
            backgroundColor: '#fff',
          },
          headerTitleStyle: {
            fontSize: 20,
            fontWeight: '600',
          },
        }}
      />

      <View style={styles.container}>
        <FlashList
          data={spaces}
          renderItem={({ item }) => <SpaceCard space={item} onPress={() => handleSpacePress(item)} />}
          estimatedItemSize={140}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={loading && page === 1} onRefresh={handleRefresh} />}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    paddingVertical: 8,
  },
});