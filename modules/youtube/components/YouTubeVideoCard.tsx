// =============================================================================
// YOUTUBE VIDEO CARD - Reusable card for video list items
// =============================================================================
// Hero-style: thumbnail with gradient title overlay (Netflix-style).
// Used on: YouTube page (playlist sections), playlist detail page.
// =============================================================================

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { YouTubeEmbed } from '@/components/media/YouTubeEmbed';
import { PlayButtonOverlay } from '@/components/media/PlayButtonOverlay';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { spacing, typography, sizing, shadows } from '@/constants/layout';
import { formatSmartDate } from '@/utils/formatDate';
import type { YouTubeVideo } from '../types/youtube';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface YouTubeVideoCardProps {
  video: YouTubeVideo;
  /** Card width (for horizontal scroll layout) */
  width?: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const YouTubeVideoCard = React.memo(function YouTubeVideoCard({ video, width }: YouTubeVideoCardProps) {
  const { colors: themeColors } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: '#000' },
        shadows.sm,
        width ? { width } : undefined,
      ]}
    >
      {!isPlaying ? (
        <AnimatedPressable
          onPress={() => setIsPlaying(true)}
          style={styles.thumbnailContainer}
        >
          <Image
            source={{ uri: video.thumbnail }}
            style={[styles.thumbnail, { backgroundColor: themeColors.border }]}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />

          <PlayButtonOverlay variant="youtube" />

          {/* Title + date gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.gradient}
          >
            <Text style={styles.title} numberOfLines={1}>
              {video.title}
            </Text>
            <Text style={styles.date}>
              {formatSmartDate(video.publishedAt)}
            </Text>
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
});

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
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
