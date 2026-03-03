// =============================================================================
// YOUTUBE PLAYLIST SCREEN - Full video list for a specific playlist
// =============================================================================
// Paginated vertical list of videos using nextPageToken.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import { BottomSheet, BottomSheetScrollView } from '@/components/common/BottomSheet';
import { stripHtmlPreserveBreaks } from '@/utils/htmlToText';
import { spacing, typography } from '@/constants/layout';
import { youtubeApi } from '@/services/api/youtube';
import { PageHeader } from '@/components/navigation/PageHeader';
import { YouTubeVideoCard } from '@/components/youtube/YouTubeVideoCard';
import type { YouTubeVideo } from '@/types/youtube';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function PlaylistDetailScreen() {
  const { id, title, description } = useLocalSearchParams<{ id: string; title?: string; description?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [infoVisible, setInfoVisible] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch videos
  // ---------------------------------------------------------------------------

  const fetchVideos = useCallback(
    async (pageToken?: string, isRefresh = false) => {
      if (!id) return;

      try {
        if (isRefresh) {
          setRefreshing(true);
          setError(null);
        } else if (!pageToken) {
          setLoading(true);
          setError(null);
        } else {
          setLoadingMore(true);
        }

        const res = await youtubeApi.getPlaylistVideos(id, 20, pageToken);

        if (!res) {
          setError('Failed to load videos');
          return;
        }

        if (pageToken) {
          setVideos((prev) => [...prev, ...res.videos]);
        } else {
          setVideos(res.videos);
        }

        setNextPageToken(res.nextPageToken);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [id],
  );

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  const handleRefresh = () => fetchVideos(undefined, true);

  const handleLoadMore = () => {
    if (!loadingMore && nextPageToken && !loading) {
      fetchVideos(nextPageToken);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={themeColors.primary} />
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top,
            backgroundColor: themeColors.background,
          },
        ]}
      >
        <PageHeader
          leftAction="back"
          onLeftPress={() => router.back()}
          title={title || 'Playlist'}
          rightIcon={description ? 'information-circle-outline' : undefined}
          onRightPress={description ? () => setInfoVisible(true) : undefined}
        />

        {error && !loading ? (
          <ErrorMessage message={error} onRetry={() => fetchVideos()} />
        ) : loading && videos.length === 0 ? (
          <LoadingSpinner />
        ) : (
          <FlashList
            data={videos}
            keyExtractor={(item) => item.videoId}
            renderItem={({ item }) => (
              <View style={styles.cardWrapper}>
                <YouTubeVideoCard video={item} />
              </View>
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={themeColors.primary}
                colors={[themeColors.primary]}
              />
            }
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="logo-youtube"
                  title="No Videos"
                  message="This playlist is empty."
                />
              ) : null
            }
            showsVerticalScrollIndicator={false}
          />
        )}
        {/* Playlist Info Bottom Sheet */}
        {description ? (
          <BottomSheet
            visible={infoVisible}
            onClose={() => setInfoVisible(false)}
            title={title || 'Playlist'}
            heightPercentage={40}
          >
            <BottomSheetScrollView contentContainerStyle={styles.infoContent}>
              <Text style={[styles.infoDescription, { color: themeColors.text }]}>
                {stripHtmlPreserveBreaks(description)}
              </Text>
            </BottomSheetScrollView>
          </BottomSheet>
        ) : null}
      </View>
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  listContent: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
  },

  cardWrapper: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },

  infoContent: {
    padding: spacing.lg,
  },

  infoDescription: {
    fontSize: typography.size.md,
    lineHeight: typography.size.md * 1.6,
  },
});
