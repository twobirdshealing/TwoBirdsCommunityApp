// =============================================================================
// COMPOSER - Reusable content creation component
// =============================================================================
// FIXED: Track space SLUG instead of ID for posting
// Native web app uses: {"space": "book-club"} NOT {"space_id": 50}
// =============================================================================

import React, { useState, useRef } from 'react';
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { MediaPreview } from './MediaPreview';
import { ComposerToolbar } from './ComposerToolbar';
import { SpaceSelector } from './SpaceSelector';
import { VideoAttachModal } from './VideoAttachModal';
import { VideoPreview } from './VideoPreview';
import { MediaItem, mediaApi } from '@/services/api/media';
import { OembedData } from '@/services/api/feeds';
import * as ImagePicker from 'expo-image-picker';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ComposerMode = 'feed' | 'comment' | 'reply';

export interface ComposerProps {
  mode: ComposerMode;
  placeholder?: string;
  submitLabel?: string;
  autoFocus?: boolean;
  maxLength?: number;
  
  // For comments/replies
  feedId?: number;
  parentId?: number;
  
  // For feeds - can preset a space (use SLUG not ID!)
  initialSpaceSlug?: string;
  initialSpaceName?: string;
  
  // Callbacks
  onSubmit: (data: ComposerSubmitData) => Promise<void>;
  onCancel?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

export interface ComposerSubmitData {
  message: string;
  title?: string;
  content_type: 'text' | 'markdown';
  // For feeds - use SLUG not ID!
  space?: string;
  // Media - web app format: media_images array
  media_images?: Array<{
    url: string;
    type: string;
    width: number;
    height: number;
    provider: string;
  }>;
  // Video embed (oembed)
  media?: {
    type: 'oembed';
    url: string;
  };
  // For comments
  parent_id?: number;
  meta?: Record<string, any>;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function Composer({
  mode,
  placeholder,
  submitLabel,
  autoFocus = false,
  maxLength = 5000,
  feedId,
  parentId,
  initialSpaceSlug,
  initialSpaceName,
  onSubmit,
  onCancel,
  onFocus,
  onBlur,
}: ComposerProps) {
  // State
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');
  const [attachments, setAttachments] = useState<MediaItem[]>([]);
  const [videoAttachment, setVideoAttachment] = useState<OembedData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);

  // Space selection - track SLUG not ID!
  const [selectedSpaceSlug, setSelectedSpaceSlug] = useState<string | null>(initialSpaceSlug || null);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string | null>(initialSpaceName || null);

  const inputRef = useRef<TextInput>(null);

  // ---------------------------------------------------------------------------
  // Defaults based on mode
  // ---------------------------------------------------------------------------

  const defaultPlaceholder = {
    feed: "What's happening?",
    comment: 'Write a comment...',
    reply: 'Write a reply...',
  };

  const defaultSubmitLabel = {
    feed: 'Post',
    comment: 'Comment',
    reply: 'Reply',
  };

  const showSpaceSelector = mode === 'feed' && !initialSpaceSlug;
  const showTitle = mode === 'feed';
  const actualPlaceholder = placeholder || defaultPlaceholder[mode];
  const actualSubmitLabel = submitLabel || defaultSubmitLabel[mode];

  // ---------------------------------------------------------------------------
  // Handle Space Selection - now receives SLUG
  // ---------------------------------------------------------------------------

  const handleSpaceSelect = (spaceSlug: string, spaceName: string) => {
    console.log('[Composer] Space selected:', { spaceSlug, spaceName });
    setSelectedSpaceSlug(spaceSlug);
    setSelectedSpaceName(spaceName);
  };

  // ---------------------------------------------------------------------------
  // Handle Focus
  // ---------------------------------------------------------------------------

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  // ---------------------------------------------------------------------------
  // Handle Image Picker
  // ---------------------------------------------------------------------------

  const handleImagePicker = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos to add images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 4 - attachments.length,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setIsUploading(true);

      for (const asset of result.assets) {
        const fileName = asset.uri.split('/').pop() || 'image.jpg';
        const fileType = asset.mimeType || 'image/jpeg';

        const response = await mediaApi.uploadMedia(
          asset.uri,
          fileType,
          fileName,
          mode === 'feed' ? 'feed' : 'comment'
        );

        if (response.success && response.data) {
          setAttachments(prev => [
            ...prev,
            {
              media_id: response.data!.media_id,
              url: response.data!.url,
              type: 'image',
              width: asset.width,
              height: asset.height,
            },
          ]);
        } else {
          Alert.alert('Upload Failed', response.error?.message || 'Could not upload image');
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setIsUploading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Remove Attachment
  // ---------------------------------------------------------------------------

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // ---------------------------------------------------------------------------
  // Handle Video Attach
  // ---------------------------------------------------------------------------

  const handleVideoPress = () => {
    setShowVideoModal(true);
  };

  const handleVideoAttach = (data: OembedData) => {
    setVideoAttachment(data);
    // Clear image attachments when video is added
    setAttachments([]);
  };

  const handleVideoRemove = () => {
    setVideoAttachment(null);
  };

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage && attachments.length === 0 && !videoAttachment) {
      return;
    }

    // Validate space selection for feeds (only if not pre-selected)
    if (mode === 'feed' && !selectedSpaceSlug && !initialSpaceSlug) {
      Alert.alert('Select a Space', 'Please select which space to post in.');
      return;
    }

    setIsSubmitting(true);
    Keyboard.dismiss();

    try {
      const submitData: ComposerSubmitData = {
        message: trimmedMessage,
        content_type: 'text',
      };

      // Add title for feeds
      if (showTitle && title.trim()) {
        submitData.title = title.trim();
      }

      // Add space SLUG for feeds (use initial if provided, otherwise selected)
      if (mode === 'feed') {
        submitData.space = initialSpaceSlug || selectedSpaceSlug || undefined;
        console.log('[Composer] Setting space slug:', submitData.space);
      }

      // Add parent_id for replies
      if (mode === 'reply' && parentId) {
        submitData.parent_id = parentId;
      }

      // Add media_images - EXACT format from web app
      if (attachments.length > 0) {
        submitData.media_images = attachments.map(item => ({
          url: item.url,
          type: 'image',
          width: 0,       // Web app sends 0
          height: 0,      // Web app sends 0
          provider: 'uploader',
        }));
      }

      // Add video embed (oembed)
      if (videoAttachment) {
        submitData.media = {
          type: 'oembed',
          url: videoAttachment.url,
        };
      }

      console.log('[Composer] Final submitData:', JSON.stringify(submitData, null, 2));

      await onSubmit(submitData);

      // Clear form on success
      setMessage('');
      setTitle('');
      setAttachments([]);
      setVideoAttachment(null);
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Character Count
  // ---------------------------------------------------------------------------

  const charCount = message.length;
  const isOverLimit = charCount > maxLength;
  const showCharCount = charCount > maxLength * 0.8;

  // ---------------------------------------------------------------------------
  // Can Submit
  // ---------------------------------------------------------------------------

  const canSubmit =
    !isSubmitting &&
    !isUploading &&
    !isOverLimit &&
    (message.trim().length > 0 || attachments.length > 0 || videoAttachment !== null);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Space Selector (only for feeds without preset space) */}
      {showSpaceSelector && (
        <View style={styles.spaceRow}>
          <SpaceSelector
            selectedSpaceSlug={selectedSpaceSlug}
            selectedSpaceName={selectedSpaceName}
            onSelect={handleSpaceSelect}
          />
        </View>
      )}

      {/* Title Input (for feeds) */}
      {showTitle && (
        <TextInput
          style={styles.titleInput}
          placeholder="Title (optional)"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
          maxLength={200}
        />
      )}

      {/* Message Input */}
      <TextInput
        ref={inputRef}
        style={[
          styles.messageInput,
          isFocused && styles.messageInputFocused,
        ]}
        placeholder={actualPlaceholder}
        placeholderTextColor={colors.textTertiary}
        value={message}
        onChangeText={setMessage}
        onFocus={handleFocus}
        onBlur={handleBlur}
        multiline
        autoFocus={autoFocus}
        maxLength={maxLength + 100}
      />

      {/* Media Preview */}
      {attachments.length > 0 && (
        <MediaPreview
          items={attachments}
          onRemove={removeAttachment}
          isUploading={isUploading}
        />
      )}

      {/* Video Preview */}
      {videoAttachment && (
        <VideoPreview
          video={videoAttachment}
          onRemove={handleVideoRemove}
        />
      )}

      {/* Character Count */}
      {showCharCount && (
        <Text style={[styles.charCount, isOverLimit && styles.charCountOver]}>
          {charCount}/{maxLength}
        </Text>
      )}

      {/* Toolbar */}
      <ComposerToolbar
        onImagePress={handleImagePicker}
        onVideoPress={mode === 'feed' ? handleVideoPress : undefined}
        onSubmit={handleSubmit}
        submitLabel={actualSubmitLabel}
        canSubmit={canSubmit}
        isSubmitting={isSubmitting}
        isUploading={isUploading}
        hasVideo={videoAttachment !== null}
      />

      {/* Video Attach Modal */}
      <VideoAttachModal
        visible={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        onAttach={handleVideoAttach}
      />
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  spaceRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  titleInput: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  messageInput: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    textAlignVertical: 'top',
    minHeight: 120,
  },

  messageInputFocused: {
    // Optional focus styling
  },

  charCount: {
    fontSize: typography.size.xs,
    color: colors.textTertiary,
    textAlign: 'right',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },

  charCountOver: {
    color: colors.error,
  },
});

export default Composer;
