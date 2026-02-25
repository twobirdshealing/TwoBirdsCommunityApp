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
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent, useEventListener } from 'expo';
import { Image } from 'expo-image';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYER_WIDTH = SCREEN_WIDTH - 48;
const PLAYER_HEIGHT = (PLAYER_WIDTH * 9) / 16; // 16:9 aspect ratio

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
  const [showControls, setShowControls] = useState(true);
  const [showPoster, setShowPoster] = useState(!!posterUrl);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Create player instance
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 0.25;
  });

  // Reactive state from player events
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  // Track time updates for progress bar
  useEventListener(player, 'timeUpdate', ({ currentTime: ct }) => {
    setCurrentTime(ct);
    if (player.duration > 0) setDuration(player.duration);
  });

  // Handle play-to-end
  useEventListener(player, 'playToEnd', () => {
    onEnd?.();
    player.currentTime = 0;
  });

  // Derived state
  const isLoading = status === 'loading' || status === 'idle';
  const isReady = status === 'readyToPlay';
  const progress = duration > 0 ? currentTime / duration : 0;

  // Handle play/pause toggle
  const handlePlayPause = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
      onPlay?.();
    }
  };

  // Format time (seconds to MM:SS)
  const formatTime = (secs: number): string => {
    const totalSeconds = Math.floor(secs);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => setShowControls(!showControls)}
      activeOpacity={1}
    >
      {/* Video */}
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
        onFirstFrameRender={() => setShowPoster(false)}
      />

      {/* Poster Image (shown until first frame renders) */}
      {showPoster && posterUrl && (
        <View style={styles.loadingOverlay}>
          <Image
            source={{ uri: posterUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
          />
        </View>
      )}

      {/* Loading Indicator */}
      {isLoading && !showPoster && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={themeColors.textInverse} />
        </View>
      )}

      {/* Play/Pause Overlay */}
      {showControls && isReady && (
        <TouchableOpacity
          style={styles.controlsOverlay}
          onPress={handlePlayPause}
          activeOpacity={0.9}
        >
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>
              {isPlaying ? '⏸' : '▶'}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Progress Bar */}
      {isReady && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: themeColors.primary }]} />
          </View>
          <Text style={styles.timeText}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </Text>
        </View>
      )}

      {/* Video Label */}
      <View style={styles.videoLabel}>
        <Text style={styles.videoLabelText}>Video</Text>
      </View>
    </TouchableOpacity>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
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

  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  playButton: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },

  playIcon: {
    color: '#000',
    fontSize: 28,
    marginLeft: 4, // Optical centering for play icon
  },

  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
  },

  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginRight: spacing.sm,
  },

  progressFill: {
    height: '100%',
    borderRadius: 2,
  },

  timeText: {
    color: '#fff',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },

  videoLabel: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.xs,
  },

  videoLabelText: {
    color: '#fff',
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});

export default VideoPlayer;
