// =============================================================================
// YOUTUBE WIDGET - Single featured video card for home page
// =============================================================================
// Shows the latest YouTube video as a hero card with thumbnail + play overlay.
// Returns null if no videos available (hides header too).
// =============================================================================

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { YouTubeEmbed } from '@/components/media/YouTubeEmbed';
import { PlayButtonOverlay } from '@/components/media/PlayButtonOverlay';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { youtubeApi } from '../services/youtubeApi';
import { useAppQuery, WIDGET_STALE_TIME } from '@/hooks/useAppQuery';
import { formatSmartDate } from '@/utils/formatDate';
import type { YouTubeVideo } from '../types/youtube';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { HomeWidget } from '@/components/home/HomeWidget';
import type { WidgetComponentProps } from '@/modules/_types';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function YouTubeWidget({ refreshKey, title, icon, onSeeAll }: WidgetComponentProps) {
  const { colors: themeColors } = useTheme();

  const { data: video } = useAppQuery<YouTubeVideo | null>({
    cacheKey: 'tbc_widget_latest_youtube',
    fetcher: async () => {
      const response = await youtubeApi.getLatestVideos(1);
      if (!response) return null;
      return response.videos[0] ?? null;
    },
    refreshKey,
    refreshOnFocus: false,
    staleTime: WIDGET_STALE_TIME,
  });

  const [isPlaying, setIsPlaying] = useState(false);

  if (!video) return null;

  return (
    <HomeWidget title={title} icon={icon} onSeeAll={onSeeAll}>
      <View style={styles.card}>
        {!isPlaying ? (
          <AnimatedPressable onPress={() => setIsPlaying(true)} style={styles.thumbnailContainer}>
            <Image
              source={{ uri: video.thumbnail }}
              style={[styles.thumbnail, { backgroundColor: themeColors.border }]}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />

            <PlayButtonOverlay variant="youtube" />

            {/* Title + date gradient */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.gradient}
            >
              <Text style={styles.title} numberOfLines={1}>
                {video.title}
              </Text>
              <Text style={styles.date}>{formatSmartDate(video.publishedAt)}</Text>
            </LinearGradient>
          </AnimatedPressable>
        ) : (
          <View style={styles.thumbnailContainer}>
            <YouTubeEmbed
              videoId={video.videoId}
              playing={isPlaying}
              onStateChange={(state) => {
                if (state === 'ended') setIsPlaying(false);
              }}
            />
          </View>
        )}
      </View>
    </HomeWidget>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
    ...shadows.sm,
  },

  thumbnailContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
  },

  thumbnail: {
    width: '100%',
    height: '100%',
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
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
    color: '#fff',
    marginBottom: 2,
  },

  date: {
    fontSize: typography.size.xs,
    color: 'rgba(255,255,255,0.7)',
  },
});

export default YouTubeWidget;
