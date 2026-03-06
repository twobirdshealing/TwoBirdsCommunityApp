// =============================================================================
// VIDEO PREVIEW - Shows attached video in composer before posting
// =============================================================================

import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { OembedData } from '@/services/api/feeds';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface VideoPreviewProps {
  video: OembedData;
  onRemove: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function VideoPreview({ video, onRemove }: VideoPreviewProps) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {video.image ? (
          <Image
            source={{ uri: video.image }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder, { backgroundColor: themeColors.backgroundSecondary }]}>
            <Ionicons name="videocam" size={32} color={themeColors.textTertiary} />
          </View>
        )}

        {/* Play icon overlay */}
        <View style={styles.playOverlay}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={20} color="#fff" />
          </View>
        </View>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={2}>
          {video.title || 'Video'}
        </Text>
        <View style={[styles.providerBadge, { backgroundColor: themeColors.primary + '20' }]}>
          <Text style={[styles.providerText, { color: themeColors.primary }]}>
            {video.provider || 'Video'}
          </Text>
        </View>
      </View>

      {/* Remove Button */}
      <Pressable
        style={styles.removeButton}
        onPress={onRemove}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={24} color={themeColors.error} />
      </Pressable>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: sizing.borderRadius.md,
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },

  thumbnailContainer: {
    width: 80,
    height: 60,
    borderRadius: sizing.borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },

  thumbnail: {
    width: '100%',
    height: '100%',
  },

  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },

  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  info: {
    flex: 1,
    marginLeft: spacing.md,
  },

  title: {
    fontSize: typography.size.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },

  providerBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: sizing.borderRadius.xs,
    alignSelf: 'flex-start',
  },

  providerText: {
    fontSize: typography.size.xs,
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  removeButton: {
    padding: spacing.xs,
  },
});

export default VideoPreview;
