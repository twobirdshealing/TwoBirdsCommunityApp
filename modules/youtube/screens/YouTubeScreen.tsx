// =============================================================================
// YOUTUBE SCREEN - Playlist catalog
// =============================================================================
// Browse playlists as a catalog. Tap a playlist to see all its videos.
// Featured/latest video is on the home widget — this is the browse page.
// =============================================================================

import React from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppQuery } from '@/hooks/useAppQuery';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { EmptyState } from '@/components/common/EmptyState';
import { spacing, typography, sizing } from '@/constants/layout';
import { youtubeApi } from '../services/youtubeApi';
import { PageHeader } from '@/components/navigation/PageHeader';
import type { YouTubePlaylist } from '../types/youtube';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function YouTubeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();

  const { data: config } = useAppQuery<{ channel_url: string }>({
    cacheKey: 'tbc_youtube_config',
    fetcher: async () => {
      const res = await youtubeApi.getConfig();
      if (!res) throw new Error('Failed to load config');
      return res;
    },
  });
  const channelUrl = config?.channel_url || '';

  const { data: playlists, isLoading: loading, isRefreshing: refreshing, error: fetchError, refresh } = useAppQuery<YouTubePlaylist[]>({
    cacheKey: 'tbc_youtube_playlists',
    fetcher: async () => {
      const res = await youtubeApi.getPlaylists();
      if (!res) throw new Error('Failed to load playlists');
      return res.playlists;
    },
  });
  const data = playlists || [];
  const error = fetchError?.message || null;

  // ---------------------------------------------------------------------------
  // Render playlist card
  // ---------------------------------------------------------------------------

  const renderPlaylistCard = ({ item }: { item: YouTubePlaylist }) => (
    <Pressable
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '/youtube/playlist/[id]',
          params: { id: item.id, title: item.title, description: item.description },
        })
      }
    >
      <Image
        source={{ uri: item.thumbnail }}
        style={[styles.thumbnail, { backgroundColor: themeColors.border }]}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
      />

      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.gradient}
      >
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.subtitle}>
          {item.videoCount} {item.videoCount === 1 ? 'video' : 'videos'}
        </Text>
      </LinearGradient>
    </Pressable>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
          title="YouTube"
          rightIcon={channelUrl ? "open-outline" : undefined}
          onRightPress={channelUrl ? () => Linking.openURL(channelUrl) : undefined}
        />

        {error && !loading ? (
          <ErrorMessage message={error} onRetry={refresh} />
        ) : loading && data.length === 0 ? (
          <LoadingSpinner />
        ) : (
          <FlashList
            data={data}
            keyExtractor={(item) => item.id}
            renderItem={renderPlaylistCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={refresh}
                tintColor={themeColors.primary}
                colors={[themeColors.primary]}
              />
            }
            ListEmptyComponent={
              !loading ? (
                <EmptyState
                  icon="logo-youtube"
                  title="No Playlists"
                  message="Check back soon for new content."
                />
              ) : null
            }
            showsVerticalScrollIndicator={false}
          />
        )}
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
    paddingBottom: spacing.xxl,
  },

  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  thumbnail: {
    width: '100%',
    aspectRatio: 16 / 9,
  },

  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xxl,
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    color: '#fff',
    marginBottom: 2,
  },

  subtitle: {
    fontSize: typography.size.xs,
    color: 'rgba(255,255,255,0.7)',
  },
});
