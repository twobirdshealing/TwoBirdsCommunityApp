// =============================================================================
// YOUTUBE WIDGET - Single featured video card for home page
// =============================================================================
// Shows the latest YouTube video as a hero card with thumbnail + play overlay.
// Returns null if no videos available.
// HomeWidget wrapping is handled externally by the home screen.
// =============================================================================

import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { YouTubeEmbed } from '@/components/media/YouTubeEmbed';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { youtubeApi } from '@/services/api/youtube';
import { useCachedData } from '@/hooks/useCachedData';
import { formatSmartDate } from '@/utils/formatDate';
import type { YouTubeVideo } from '@/types/youtube';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface YouTubeWidgetProps {
  refreshKey: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function YouTubeWidget({ refreshKey }: YouTubeWidgetProps) {
  const { colors: themeColors } = useTheme();

  const { data: video } = useCachedData<YouTubeVideo | null>({
    cacheKey: 'tbc_widget_latest_youtube',
    fetcher: async () => {
      const response = await youtubeApi.getLatestVideos(1);
      if (!response) return null;
      return response.videos[0] ?? null;
    },
    refreshKey,
    refreshOnFocus: false,
  });

  const [isPlaying, setIsPlaying] = useState(false);

  if (!video) return null;

  return (
    <View style={styles.card}>
      {!isPlaying ? (
        <AnimatedPressable onPress={() => setIsPlaying(true)} style={styles.thumbnailContainer}>
          <Image
            source={{ uri: video.thumbnail }}
            style={[styles.thumbnail, { backgroundColor: themeColors.skeleton }]}
            resizeMode="cover"
          />

          {/* Play button */}
          <View style={styles.playOverlay}>
            <View style={styles.playButton}>
              <Ionicons name="play" size={20} color="#fff" />
            </View>
          </View>

          {/* YouTube badge */}
          <View style={styles.youtubeBadge}>
            <Ionicons name="logo-youtube" size={12} color="#fff" />
          </View>

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

  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },

  playButton: {
    width: 48,
    height: 34,
    borderRadius: sizing.borderRadius.sm,
    backgroundColor: 'rgba(255, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  youtubeBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: sizing.borderRadius.xs,
  },

  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xxxl,
  },

  title: {
    fontSize: typography.size.sm,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },

  date: {
    fontSize: typography.size.xs,
    color: 'rgba(255,255,255,0.7)',
  },
});

export default YouTubeWidget;
