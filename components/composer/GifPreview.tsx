// =============================================================================
// GIF PREVIEW - Shows attached GIF in composer before posting
// =============================================================================
// Mirrors VideoPreview pattern — horizontal card with thumbnail, label, remove.
// =============================================================================

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { GifAttachment } from '@/types/gif';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface GifPreviewProps {
  gif: GifAttachment;
  onRemove: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function GifPreview({ gif, onRemove }: GifPreviewProps) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: gif.previewUrl }}
          style={styles.thumbnail}
          contentFit="cover"
          autoplay={true}
          transition={200}
          cachePolicy="memory-disk"
        />
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
          GIF
        </Text>
        <View style={[styles.providerBadge, { backgroundColor: themeColors.primary + '20' }]}>
          <Text style={[styles.providerText, { color: themeColors.primary }]}>
            Giphy
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
  },

  thumbnail: {
    width: '100%',
    height: '100%',
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
  },

  removeButton: {
    padding: spacing.xs,
  },
});

export default GifPreview;
