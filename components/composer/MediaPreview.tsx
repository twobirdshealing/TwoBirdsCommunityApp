// =============================================================================
// MEDIA PREVIEW - Shows attached images before posting
// =============================================================================

import React from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { MediaItem } from '@/services/api/media';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MediaPreviewProps {
  items: MediaItem[];
  onRemove: (index: number) => void;
  isUploading: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function MediaPreview({ items, onRemove, isUploading }: MediaPreviewProps) {
  const { colors: themeColors } = useTheme();

  if (items.length === 0 && !isUploading) {
    return null;
  }

  return (
    <View style={[styles.container, { borderTopColor: themeColors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((item, index) => (
          <View key={`${item.media_id}-${index}`} style={[styles.imageContainer, { backgroundColor: themeColors.skeleton }]}>
            <Image source={{ uri: item.url }} style={styles.image} />
            
            {/* Remove Button */}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => onRemove(index)}
            >
              <Ionicons name="close-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        ))}

        {/* Upload Indicator */}
        {isUploading && (
          <View style={[styles.imageContainer, styles.uploadingContainer, { backgroundColor: themeColors.backgroundSecondary, borderColor: themeColors.border }]}>
            <ActivityIndicator size="large" color={themeColors.primary} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },

  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },

  imageContainer: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
  },

  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },

  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },

  uploadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
  },
});

export default MediaPreview;
