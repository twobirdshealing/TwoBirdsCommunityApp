// =============================================================================
// VIDEO PREVIEW - Shows attached video in composer before posting
// =============================================================================

import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
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
  return (
    <View style={styles.container}>
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {video.image ? (
          <Image
            source={{ uri: video.image }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons name="videocam" size={32} color={colors.textTertiary} />
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
        <Text style={styles.title} numberOfLines={2}>
          {video.title || 'Video'}
        </Text>
        <View style={styles.providerBadge}>
          <Text style={styles.providerText}>
            {video.provider || 'Video'}
          </Text>
        </View>
      </View>

      {/* Remove Button */}
      <TouchableOpacity
        style={styles.removeButton}
        onPress={onRemove}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close-circle" size={24} color={colors.error} />
      </TouchableOpacity>
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
    backgroundColor: colors.background,
    borderRadius: sizing.borderRadius.md,
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
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
    backgroundColor: colors.backgroundSecondary,
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
    color: colors.text,
    marginBottom: spacing.xs,
  },

  providerBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: sizing.borderRadius.xs,
    alignSelf: 'flex-start',
  },

  providerText: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  removeButton: {
    padding: spacing.xs,
  },
});

export default VideoPreview;
