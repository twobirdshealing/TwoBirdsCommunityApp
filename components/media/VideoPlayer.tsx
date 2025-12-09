// =============================================================================
// VIDEO PLAYER - Direct video file playback
// =============================================================================
// Uses expo-av for native video playback of MP4, WebM, etc.
// Shows thumbnail/first frame until user taps play.
//
// REQUIRED: Already included with Expo!
//   npx expo install expo-av
// =============================================================================

import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';

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
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(true);
  
  const isPlaying = status?.isLoaded && status.isPlaying;
  const isBuffering = status?.isLoaded && status.isBuffering;
  
  // Handle play/pause toggle
  const handlePlayPause = async () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
      onPlay?.();
    }
  };
  
  // Handle playback status update
  const handlePlaybackStatusUpdate = (newStatus: AVPlaybackStatus) => {
    setStatus(newStatus);
    
    if (newStatus.isLoaded) {
      setLoading(false);
      
      if (newStatus.didJustFinish) {
        onEnd?.();
        // Reset to beginning
        videoRef.current?.setPositionAsync(0);
      }
    }
  };
  
  // Format time (seconds to MM:SS)
  const formatTime = (millis: number): string => {
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const currentTime = status?.isLoaded ? status.positionMillis : 0;
  const duration = status?.isLoaded ? status.durationMillis || 0 : 0;
  const progress = duration > 0 ? currentTime / duration : 0;
  
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => setShowControls(!showControls)}
      activeOpacity={1}
    >
      {/* Video */}
      <Video
        ref={videoRef}
        source={{ uri: url }}
        posterSource={posterUrl ? { uri: posterUrl } : undefined}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        useNativeControls={false}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onLoadStart={() => setLoading(true)}
      />
      
      {/* Loading Indicator */}
      {(loading || isBuffering) && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.textInverse} />
        </View>
      )}
      
      {/* Play/Pause Overlay */}
      {showControls && !loading && (
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
      {!loading && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
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
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  
  timeText: {
    color: colors.textInverse,
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
    color: colors.textInverse,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
});

export default VideoPlayer;
