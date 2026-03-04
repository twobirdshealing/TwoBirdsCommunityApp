// =============================================================================
// YOUTUBE PLAYLIST SCREEN - Full video list for a specific playlist
// =============================================================================
// Paginated vertical list of videos using nextPageToken.
// =============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
  const [totalResults, setTotalResults] = useState(0);
  const [infoVisible, setInfoVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fetchingAll, setFetchingAll] = useState(false);
  const fetchAllCancelledRef = useRef(false);

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
          setTotalResults(res.totalResults);
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
    if (!loadingMore && nextPageToken && !loading && !fetchingAll) {
      fetchVideos(nextPageToken);
    }
  };

  // ---------------------------------------------------------------------------
  // Search: auto-fetch remaining pages when user starts searching
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!searchQuery.trim() || !nextPageToken || fetchingAll) return;

    let cancelled = false;
    fetchAllCancelledRef.current = false;

    const fetchRemaining = async () => {
      setFetchingAll(true);
      let token: string | null = nextPageToken;

      while (token && !cancelled && !fetchAllCancelledRef.current) {
        const res = await youtubeApi.getPlaylistVideos(id!, 50, token);
        if (!res || cancelled || fetchAllCancelledRef.current) break;

        setVideos((prev) => [...prev, ...res.videos]);
        token = res.nextPageToken;
        setNextPageToken(res.nextPageToken);
      }

      if (!cancelled) setFetchingAll(false);
    };

    fetchRemaining();

    return () => {
      cancelled = true;
    };
    // Only trigger when searchQuery becomes non-empty (not on every keystroke)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery.trim() !== '' ? 'searching' : 'idle']);

  const handleClearSearch = () => {
    setSearchQuery('');
    fetchAllCancelledRef.current = true;
    setFetchingAll(false);
  };

  // ---------------------------------------------------------------------------
  // Filtered videos
  // ---------------------------------------------------------------------------

  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;
    const query = searchQuery.toLowerCase().trim();
    return videos.filter((v) => v.title.toLowerCase().includes(query));
  }, [videos, searchQuery]);

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

        {/* Search Bar */}
        {!loading && videos.length > 0 && (
          <View style={[styles.searchContainer, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
            <View style={[styles.searchInputContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
              <Ionicons name="search-outline" size={20} color={themeColors.textTertiary} style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }]}
                placeholder="Search videos..."
                placeholderTextColor={themeColors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {searchQuery.length > 0 && (
                <Text style={[styles.clearButton, { color: themeColors.textTertiary }]} onPress={handleClearSearch}>
                  ✕
                </Text>
              )}
            </View>

            {searchQuery.length > 0 && (
              <View style={styles.resultRow}>
                <Text style={[styles.resultCount, { color: themeColors.textSecondary }]}>
                  {filteredVideos.length} of {totalResults || videos.length} videos
                </Text>
                {fetchingAll && (
                  <ActivityIndicator size="small" color={themeColors.textTertiary} style={styles.searchSpinner} />
                )}
              </View>
            )}
          </View>
        )}

        {error && !loading ? (
          <ErrorMessage message={error} onRetry={() => fetchVideos()} />
        ) : loading && videos.length === 0 ? (
          <LoadingSpinner />
        ) : (
          <FlashList
            data={filteredVideos}
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
                searchQuery.length > 0 ? (
                  <View style={styles.emptySearchContainer}>
                    <Ionicons name="search-outline" size={48} color={themeColors.textTertiary} style={styles.emptyIcon} />
                    <Text style={[styles.emptySearchText, { color: themeColors.textSecondary }]}>
                      No videos match &quot;{searchQuery}&quot;
                    </Text>
                    {fetchingAll && (
                      <Text style={[styles.emptySearchHint, { color: themeColors.textTertiary }]}>
                        Still loading more videos...
                      </Text>
                    )}
                    <Text style={[styles.clearSearchButton, { color: themeColors.primary }]} onPress={handleClearSearch}>
                      Clear search
                    </Text>
                  </View>
                ) : (
                  <EmptyState
                    icon="logo-youtube"
                    title="No Videos"
                    message="This playlist is empty."
                  />
                )
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

  // Search Bar
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },

  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
  },

  searchIcon: {
    marginRight: spacing.sm,
  },

  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    fontSize: typography.size.md,
  },

  clearButton: {
    fontSize: 16,
    padding: spacing.xs,
  },

  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },

  resultCount: {
    fontSize: typography.size.sm,
    textAlign: 'center',
  },

  searchSpinner: {
    marginLeft: spacing.sm,
  },

  // Empty Search
  emptySearchContainer: {
    alignItems: 'center',
    padding: spacing.xxl,
  },

  emptyIcon: {
    marginBottom: spacing.md,
  },

  emptySearchText: {
    fontSize: typography.size.md,
    textAlign: 'center',
  },

  emptySearchHint: {
    fontSize: typography.size.sm,
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  clearSearchButton: {
    fontSize: typography.size.md,
    fontWeight: '600',
    marginTop: spacing.lg,
    padding: spacing.sm,
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
