// =============================================================================
// YOUTUBE EMBED - In-app YouTube video playback
// =============================================================================
// Uses react-native-youtube-iframe for native playback.
// Shows thumbnail until user taps play, then loads the player.
//
// REQUIRED: Install the package:
//   npm install react-native-youtube-iframe
// =============================================================================

import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';

// Try to import YouTube player, fallback if not installed
let YoutubePlayer: any = null;
try {
  YoutubePlayer = require('react-native-youtube-iframe').default;
} catch (e) {
  // Package not installed - will show fallback
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYER_WIDTH = SCREEN_WIDTH - 48;
const PLAYER_HEIGHT = (PLAYER_WIDTH * 9) / 16; // 16:9 aspect ratio

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface YouTubeEmbedProps {
  videoId: string;
  onPlay?: () => void;
  onEnd?: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function YouTubeEmbed({ videoId, onPlay, onEnd }: YouTubeEmbedProps) {
  const [showPlayer, setShowPlayer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  
  // Handle play button press
  const handlePlayPress = () => {
    setShowPlayer(true);
    setLoading(true);
    onPlay?.();
  };
  
  // Handle player state change
  const onStateChange = useCallback((state: string) => {
    if (state === 'playing') {
      setPlaying(true);
      setLoading(false);
    } else if (state === 'ended') {
      setPlaying(false);
      onEnd?.();
    } else if (state === 'paused') {
      setPlaying(false);
    }
  }, [onEnd]);
  
  // Handle player ready
  const onReady = useCallback(() => {
    setLoading(false);
  }, []);
  
  // Fallback if youtube-iframe not installed
  if (!YoutubePlayer) {
    return (
      <TouchableOpacity 
        style={styles.fallbackContainer}
        onPress={() => {
          // Open in YouTube app or browser
          const { Linking } = require('react-native');
          Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
        }}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={styles.playButtonOverlay}>
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        </View>
        <View style={styles.youtubeLabel}>
          <Text style={styles.youtubeLabelText}>YouTube</Text>
        </View>
      </TouchableOpacity>
    );
  }
  
  // Show thumbnail with play button (before loading player)
  if (!showPlayer) {
    return (
      <TouchableOpacity 
        style={styles.container}
        onPress={handlePlayPress}
        activeOpacity={0.9}
      >
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        <View style={styles.playButtonOverlay}>
          <View style={styles.playButton}>
            <Text style={styles.playIcon}>▶</Text>
          </View>
        </View>
        <View style={styles.youtubeLabel}>
          <Text style={styles.youtubeLabelText}>YouTube</Text>
        </View>
      </TouchableOpacity>
    );
  }
  
  // Show YouTube player
  return (
    <View style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.textInverse} />
        </View>
      )}
      
      <YoutubePlayer
        height={PLAYER_HEIGHT}
        width={PLAYER_WIDTH}
        videoId={videoId}
        play={true}
        onChangeState={onStateChange}
        onReady={onReady}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
        }}
      />
    </View>
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
  
  fallbackContainer: {
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  
  playButtonOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  
  playButton: {
    width: 68,
    height: 48,
    backgroundColor: 'rgba(255,0,0,0.9)',
    borderRadius: sizing.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  playIcon: {
    color: colors.textInverse,
    fontSize: 24,
    marginLeft: 4, // Optical centering
  },
  
  youtubeLabel: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.xs,
  },
  
  youtubeLabelText: {
    color: colors.textInverse,
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },
  
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    zIndex: 10,
  },
});

export default YouTubeEmbed;
