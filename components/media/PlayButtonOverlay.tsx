// =============================================================================
// PLAY BUTTON OVERLAY - Shared play button for video thumbnails
// =============================================================================
// Two variants:
//   'youtube' — Red pill (48x34) + YouTube badge (top-left)
//   'video'   — White circle (48x48), no badge
// Parent handles press — this is purely presentational.
// =============================================================================

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, sizing } from '@/constants/layout';

interface PlayButtonOverlayProps {
  variant?: 'youtube' | 'video';
}

export function PlayButtonOverlay({ variant = 'video' }: PlayButtonOverlayProps) {
  const isYouTube = variant === 'youtube';

  return (
    <>
      <View style={styles.overlay}>
        <View style={isYouTube ? styles.youtubeButton : styles.videoButton}>
          <Ionicons name="play" size={20} color={isYouTube ? '#fff' : '#000'} />
        </View>
      </View>
      {isYouTube && (
        <View style={styles.badge}>
          <Ionicons name="logo-youtube" size={12} color="#fff" />
        </View>
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },

  youtubeButton: {
    width: 48,
    height: 34,
    borderRadius: sizing.borderRadius.sm,
    backgroundColor: 'rgba(255, 0, 0, 0.85)', // YouTube brand red
    justifyContent: 'center',
    alignItems: 'center',
  },

  videoButton: {
    width: 48,
    height: 48,
    borderRadius: sizing.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: sizing.borderRadius.sm,
  },
});
