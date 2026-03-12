// =============================================================================
// VIDEO PLAYER - Direct video file playback
// =============================================================================
// Uses expo-video for native video playback of MP4, WebM, etc.
// Shows thumbnail/first frame until user taps play.
//
// REQUIRED:
//   npx expo install expo-video
// =============================================================================

import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent, useEventListener } from 'expo';
import { Image } from 'expo-image';
import { sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface VideoPlayerProps {
  url: string;
  posterUrl?: string;
  onPlay?: () => void;
  onEnd?: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function VideoPlayer({ url, posterUrl, onPlay, onEnd }: VideoPlayerProps) {
  const { colors: themeColors } = useTheme();
  const [showPoster, setShowPoster] = useState(!!posterUrl);

  // Create player instance
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
  });

  const { status } = useEvent(player, 'statusChange', { status: player.status });

  // Handle play-to-end
  useEventListener(player, 'playToEnd', () => {
    onEnd?.();
    player.currentTime = 0;
  });

  // Notify parent when playback starts
  useEventListener(player, 'playingChange', ({ isPlaying: playing }) => {
    if (playing) onPlay?.();
  });

  const isLoading = status === 'loading' || status === 'idle';

  return (
    <View style={styles.container}>
      {/* Video with native controls */}
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls
        allowsFullscreen
        onFirstFrameRender={() => setShowPoster(false)}
      />

      {/* Poster Image (shown until first frame renders) */}
      {showPoster && posterUrl && (
        <View style={styles.loadingOverlay}>
          <Image
            source={{ uri: posterUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
          />
        </View>
      )}

      {/* Loading Indicator */}
      {isLoading && !showPoster && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={themeColors.textInverse} />
        </View>
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  video: {
    width: '100%',
    height: '100%',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});

export default VideoPlayer;
