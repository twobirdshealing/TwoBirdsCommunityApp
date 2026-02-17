// =============================================================================
// VIDEO ATTACH MODAL - Modal for attaching video via URL
// =============================================================================
// Allows users to paste a YouTube/video URL and fetch oembed metadata
// Shows preview before attaching to post
// REFACTORED: Uses shared BottomSheet component
// =============================================================================

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { BottomSheet } from '@/components/common/BottomSheet';
import { feedsApi, OembedData } from '@/services/api/feeds';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface VideoAttachModalProps {
  visible: boolean;
  onClose: () => void;
  onAttach: (data: OembedData) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function VideoAttachModal({
  visible,
  onClose,
  onAttach,
}: VideoAttachModalProps) {
  const { colors: themeColors } = useTheme();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<OembedData | null>(null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleEmbed = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      Alert.alert('Enter URL', 'Please paste a video URL to embed.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await feedsApi.getOembed(trimmedUrl);
      if (response.oembed) {
        setPreview(response.oembed);
      } else {
        Alert.alert('Invalid URL', 'Could not get video information. Please check the URL.');
      }
    } catch (error: any) {
      console.error('[VideoAttachModal] Error fetching oembed:', error);
      Alert.alert('Error', error.message || 'Could not fetch video information.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAttach = () => {
    if (preview) {
      onAttach(preview);
      handleReset();
      onClose();
    }
  };

  const handleReset = () => {
    setUrl('');
    setPreview(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      heightMode="content"
      maxHeight="80%"
      title="Attach Video"
    >
      {/* Tab indicator (just visual, oembed only for now) */}
      <View style={styles.tabs}>
        <View style={[styles.tab, styles.tabActive, { backgroundColor: themeColors.text }]}>
          <Text style={[styles.tabText, styles.tabTextActive, { color: themeColors.surface }]}>Oembed</Text>
        </View>
        <View style={[styles.tab, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.tabText, { color: themeColors.textSecondary }]}>Custom HTML Code</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {!preview ? (
          <>
            <Text style={[styles.subtitle, { color: themeColors.text }]}>Add Featured Video for this post</Text>
            <Text style={[styles.description, { color: themeColors.textSecondary }]}>
              Embed from Vimeo, YouTube, Wistia and more
            </Text>

            {/* URL Input */}
            <View style={[styles.inputRow, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
              <TextInput
                style={[styles.input, { color: themeColors.text }]}
                placeholder="Paste a URL to embed"
                placeholderTextColor={themeColors.textTertiary}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              <TouchableOpacity
                style={[styles.embedButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }, isLoading && styles.embedButtonDisabled]}
                onPress={handleEmbed}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={themeColors.text} />
                ) : (
                  <Text style={[styles.embedButtonText, { color: themeColors.text }]}>Embed</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            {/* Preview */}
            <View style={[styles.preview, { backgroundColor: themeColors.background }]}>
              {preview.image && (
                <Image
                  source={{ uri: preview.image }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              )}
              <View style={styles.previewInfo}>
                <Text style={[styles.previewTitle, { color: themeColors.text }]} numberOfLines={2}>
                  {preview.title || 'Video'}
                </Text>
                {preview.author_name && (
                  <Text style={[styles.previewAuthor, { color: themeColors.textSecondary }]}>
                    {preview.author_name}
                  </Text>
                )}
                <View style={[styles.previewProvider, { backgroundColor: themeColors.primary + '20' }]}>
                  <Text style={[styles.previewProviderText, { color: themeColors.primary }]}>
                    {preview.provider || 'Video'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Remove Link */}
            <TouchableOpacity onPress={handleReset} style={styles.removeLink}>
              <Text style={[styles.removeLinkText, { color: themeColors.error }]}>Remove Media</Text>
            </TouchableOpacity>

            {/* Attach Button */}
            <TouchableOpacity style={[styles.attachButton, { backgroundColor: themeColors.primary }]} onPress={handleAttach}>
              <Text style={[styles.attachButtonText, { color: themeColors.surface }]}>Attach Video</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </BottomSheet>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },

  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
  },

  tabActive: {
  },

  tabText: {
    fontSize: typography.size.sm,
  },

  tabTextActive: {
    fontWeight: '500',
  },

  content: {
    padding: spacing.lg,
  },

  subtitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },

  description: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    padding: spacing.sm,
    gap: spacing.sm,
  },

  input: {
    flex: 1,
    fontSize: typography.size.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },

  embedButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
    borderWidth: 1,
  },

  embedButtonDisabled: {
    opacity: 0.6,
  },

  embedButtonText: {
    fontSize: typography.size.sm,
    fontWeight: '500',
  },

  preview: {
    borderRadius: sizing.borderRadius.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },

  previewImage: {
    width: '100%',
    height: 180,
  },

  previewInfo: {
    padding: spacing.md,
  },

  previewTitle: {
    fontSize: typography.size.md,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },

  previewAuthor: {
    fontSize: typography.size.sm,
    marginBottom: spacing.sm,
  },

  previewProvider: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.xs,
    alignSelf: 'flex-start',
  },

  previewProviderText: {
    fontSize: typography.size.xs,
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  removeLink: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },

  removeLinkText: {
    fontSize: typography.size.sm,
  },

  attachButton: {
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
    alignItems: 'center',
  },

  attachButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },
});

export default VideoAttachModal;
