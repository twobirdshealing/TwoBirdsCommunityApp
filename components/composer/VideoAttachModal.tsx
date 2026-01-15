// =============================================================================
// VIDEO ATTACH MODAL - Modal for attaching video via URL
// =============================================================================
// Allows users to paste a YouTube/video URL and fetch oembed metadata
// Shows preview before attaching to post
// =============================================================================

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Attach Video</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Tab indicator (just visual, oembed only for now) */}
          <View style={styles.tabs}>
            <View style={[styles.tab, styles.tabActive]}>
              <Text style={[styles.tabText, styles.tabTextActive]}>Oembed</Text>
            </View>
            <View style={styles.tab}>
              <Text style={styles.tabText}>Custom HTML Code</Text>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {!preview ? (
              <>
                <Text style={styles.subtitle}>Add Featured Video for this post</Text>
                <Text style={styles.description}>
                  Embed from Vimeo, YouTube, Wistia and more
                </Text>

                {/* URL Input */}
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Paste a URL to embed"
                    placeholderTextColor={colors.textTertiary}
                    value={url}
                    onChangeText={setUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                  />
                  <TouchableOpacity
                    style={[styles.embedButton, isLoading && styles.embedButtonDisabled]}
                    onPress={handleEmbed}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.text} />
                    ) : (
                      <Text style={styles.embedButtonText}>Embed</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                {/* Preview */}
                <View style={styles.preview}>
                  {preview.image && (
                    <Image
                      source={{ uri: preview.image }}
                      style={styles.previewImage}
                      resizeMode="cover"
                    />
                  )}
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewTitle} numberOfLines={2}>
                      {preview.title || 'Video'}
                    </Text>
                    {preview.author_name && (
                      <Text style={styles.previewAuthor}>
                        {preview.author_name}
                      </Text>
                    )}
                    <View style={styles.previewProvider}>
                      <Text style={styles.previewProviderText}>
                        {preview.provider || 'Video'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Remove Link */}
                <TouchableOpacity onPress={handleReset} style={styles.removeLink}>
                  <Text style={styles.removeLinkText}>Remove Media</Text>
                </TouchableOpacity>

                {/* Attach Button */}
                <TouchableOpacity style={styles.attachButton} onPress={handleAttach}>
                  <Text style={styles.attachButtonText}>Attach Video</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },

  container: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: sizing.borderRadius.xl,
    borderTopRightRadius: sizing.borderRadius.xl,
    maxHeight: '80%',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    color: colors.text,
  },

  closeButton: {
    padding: spacing.xs,
  },

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
    backgroundColor: colors.background,
  },

  tabActive: {
    backgroundColor: colors.text,
  },

  tabText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  tabTextActive: {
    color: colors.surface,
    fontWeight: '500',
  },

  content: {
    padding: spacing.lg,
  },

  subtitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },

  description: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: sizing.borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.sm,
    gap: spacing.sm,
  },

  input: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.text,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },

  embedButton: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },

  embedButtonDisabled: {
    opacity: 0.6,
  },

  embedButtonText: {
    fontSize: typography.size.sm,
    fontWeight: '500',
    color: colors.text,
  },

  preview: {
    backgroundColor: colors.background,
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
    color: colors.text,
    marginBottom: spacing.xs,
  },

  previewAuthor: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },

  previewProvider: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: sizing.borderRadius.xs,
    alignSelf: 'flex-start',
  },

  previewProviderText: {
    fontSize: typography.size.xs,
    color: colors.primary,
    fontWeight: '500',
    textTransform: 'capitalize',
  },

  removeLink: {
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },

  removeLinkText: {
    fontSize: typography.size.sm,
    color: colors.error,
  },

  attachButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
    alignItems: 'center',
  },

  attachButtonText: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: '#fff',
  },
});

export default VideoAttachModal;
