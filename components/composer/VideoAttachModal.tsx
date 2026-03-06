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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { BottomSheet, SheetInput } from '@/components/common/BottomSheet';
import { feedsApi, OembedData } from '@/services/api/feeds';
import { createLogger } from '@/utils/logger';

const log = createLogger('VideoAttach');

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
      if (response.success && response.data.oembed) {
        // Immediately attach and close — preview shows as attachment card outside sheet
        onAttach(response.data.oembed);
        setUrl('');
        onClose();
      } else {
        Alert.alert('Invalid URL', 'Could not get video information. Please check the URL.');
      }
    } catch (error: unknown) {
      log.error('Error fetching oembed:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not fetch video information.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setUrl('');
    onClose();
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
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
        <Text style={[styles.subtitle, { color: themeColors.text }]}>Add Featured Video for this post</Text>
        <Text style={[styles.description, { color: themeColors.textSecondary }]}>
          Embed from Vimeo, YouTube, Wistia and more
        </Text>

        {/* URL Input */}
        <View style={[styles.inputRow, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
          <SheetInput>
            {(inputProps) => (
              <TextInput
                {...inputProps}
                style={[styles.input, { color: themeColors.text }]}
                placeholder="Paste a URL to embed"
                placeholderTextColor={themeColors.textTertiary}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            )}
          </SheetInput>
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
});

export default VideoAttachModal;
