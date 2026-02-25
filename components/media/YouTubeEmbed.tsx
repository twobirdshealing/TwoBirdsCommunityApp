// =============================================================================
// YOUTUBE EMBED - Simple YouTube video player component
// =============================================================================
// Uses react-native-youtube-iframe for native playback.
// This is a "dumb" component - parent controls play state.
//
// REQUIRED: Install the package:
//   npm install react-native-youtube-iframe
// =============================================================================

import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

// Try to import YouTube player, fallback if not installed
let YoutubePlayer: any = null;
try {
  YoutubePlayer = require('react-native-youtube-iframe').default;
} catch (e) {
  // Package not installed - will show fallback
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DEFAULT_PLAYER_WIDTH = SCREEN_WIDTH - 48;

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface YouTubeEmbedProps {
  videoId: string;
  playing?: boolean;
  onPlay?: () => void;
  onStateChange?: (state: string) => void;
  onReady?: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function YouTubeEmbed({
  videoId,
  playing = false,
  onPlay,
  onStateChange,
  onReady,
}: YouTubeEmbedProps) {
  const { colors: themeColors } = useTheme();
  const [loading, setLoading] = React.useState(true);
  const [playerWidth, setPlayerWidth] = React.useState(DEFAULT_PLAYER_WIDTH);
  const playerHeight = (playerWidth * 9) / 16;

  // Handle player state change
  const handleStateChange = useCallback((state: string) => {
    if (state === 'playing') {
      setLoading(false);
      onPlay?.();
    }
    onStateChange?.(state);
  }, [onStateChange, onPlay]);

  // Handle player ready
  const handleReady = useCallback(() => {
    setLoading(false);
    onReady?.();
  }, [onReady]);

  // Fallback if youtube-iframe not installed
  if (!YoutubePlayer) {
    return (
      <TouchableOpacity
        style={styles.fallbackContainer}
        onPress={() => {
          Linking.openURL(`https://www.youtube.com/watch?v=${videoId}`);
        }}
        activeOpacity={0.9}
      >
        <View style={styles.fallbackContent}>
          <Text style={styles.fallbackText}>Open in YouTube</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Show YouTube player - parent controls play state
  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== playerWidth) setPlayerWidth(w);
      }}
    >
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={themeColors.textInverse} />
        </View>
      )}

      <YoutubePlayer
        height={playerHeight}
        width={playerWidth}
        videoId={videoId}
        play={playing}
        onChangeState={handleStateChange}
        onReady={handleReady}
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
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },

  fallbackContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  fallbackContent: {
    padding: 20,
    backgroundColor: 'rgba(255,0,0,0.9)',
    borderRadius: sizing.borderRadius.md,
  },

  fallbackText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
