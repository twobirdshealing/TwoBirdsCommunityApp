// =============================================================================
// COMPOSER - Reusable content creation component
// =============================================================================
// Used for: Creating feeds, comments, replies
// Supports: Text, emojis, image attachments, space selection
// UPDATED: Hides SpaceSelector when space is pre-selected
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
import { MediaItem, mediaApi } from '@/services/api/media';
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
  
  // For feeds - can preset a space
  initialSpaceId?: number;
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
  meta?: {
    media_items?: any[];
    media_preview?: any;
  };
  // For feeds
  space_id?: number;
  // For comments
  parent_id?: number;
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
  initialSpaceId,
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
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  
  // Space selection (for feeds)
  const [selectedSpaceId, setSelectedSpaceId] = useState<number | null>(initialSpaceId || null);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string | null>(initialSpaceName || null);
  
  const inputRef = useRef<TextInput>(null);

  // ---------------------------------------------------------------------------
  // Defaults based on mode
  // ---------------------------------------------------------------------------

  const defaultPlaceholder = {
    feed: "What's happening?",
    comment: 'Write a comment...',
    reply: 'Write a reply...',
  }[mode];

  const defaultSubmitLabel = {
    feed: 'Post',
    comment: 'Post',
    reply: 'Reply',
  }[mode];

  const showTitle = mode === 'feed';
  // Only show SpaceSelector if no space is pre-selected
  const showSpaceSelector = mode === 'feed' && !initialSpaceId;
  const showToolbar = true;
  
  // ---------------------------------------------------------------------------
  // Space Selection
  // ---------------------------------------------------------------------------

  const handleSpaceSelect = (spaceId: number, spaceName: string) => {
    setSelectedSpaceId(spaceId);
    setSelectedSpaceName(spaceName);
  };

  // ---------------------------------------------------------------------------
  // Image Picker (Fixed deprecation)
  // ---------------------------------------------------------------------------

  const pickImage = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photo library to attach images.'
        );
        return;
      }

      // Pick image - FIXED: Use MediaType instead of deprecated MediaTypeOptions
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // Fixed deprecation warning
        allowsEditing: false,
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 4,
      });

      if (result.canceled) return;

      // Upload each selected image
      setIsUploading(true);
      
      for (const asset of result.assets) {
        const fileName = asset.uri.split('/').pop() || 'image.jpg';
        const type = asset.mimeType || 'image/jpeg';
        
        const response = await mediaApi.uploadMedia(
          asset.uri,
          type,
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
  // Submit
  // ---------------------------------------------------------------------------

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();
    
    if (!trimmedMessage && attachments.length === 0) {
      return;
    }

    // Validate space selection for feeds (only if not pre-selected)
    if (mode === 'feed' && !selectedSpaceId && !initialSpaceId) {
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

      // Add space_id for feeds (use initial if provided, otherwise selected)
      if (mode === 'feed') {
        submitData.space_id = initialSpaceId || selectedSpaceId || undefined;
      }

      // Add parent_id for replies
      if (mode === 'reply' && parentId) {
        submitData.parent_id = parentId;
      }

      // Add media meta if attachments exist
      if (attachments.length > 0) {
        submitData.meta = {
          media_items: mediaApi.buildMediaItems(attachments),
          media_preview: mediaApi.buildMediaPreview(attachments),
        };
      }

      await onSubmit(submitData);

      // Clear form on success
      setMessage('');
      setTitle('');
      setAttachments([]);
    } catch (error) {
      console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Focus Management
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
  // Can Submit?
  // ---------------------------------------------------------------------------

  const hasContent = message.trim().length > 0 || attachments.length > 0;
  const hasSpace = mode !== 'feed' || selectedSpaceId !== null || initialSpaceId !== null;
  const canSubmit = hasContent && hasSpace && !isSubmitting && !isUploading;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
      {/* Space Selector (feeds only, not when pre-selected) */}
      {showSpaceSelector && (
        <View style={styles.spaceRow}>
          <SpaceSelector
            selectedSpaceId={selectedSpaceId}
            selectedSpaceName={selectedSpaceName}
            onSelect={handleSpaceSelect}
          />
        </View>
      )}

      {/* Title Input (feeds only) */}
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
          mode === 'comment' && styles.messageInputCompact,
        ]}
        placeholder={placeholder || defaultPlaceholder}
        placeholderTextColor={colors.textTertiary}
        value={message}
        onChangeText={setMessage}
        onFocus={handleFocus}
        onBlur={handleBlur}
        multiline
        maxLength={maxLength}
        autoFocus={autoFocus}
        textAlignVertical="top"
      />

      {/* Media Previews */}
      {attachments.length > 0 && (
        <MediaPreview
          items={attachments}
          onRemove={removeAttachment}
          isUploading={isUploading}
        />
      )}

      {/* Toolbar */}
      {showToolbar && (
        <ComposerToolbar
          onImagePress={pickImage}
          onEmojiPress={() => {
            Alert.alert(
              'Tip',
              'Use your keyboard emoji picker! 😊\n\niOS: Press and hold 🌐\nAndroid: Tap the emoji icon on keyboard'
            );
          }}
          isUploading={isUploading}
          canSubmit={canSubmit}
          submitLabel={submitLabel || defaultSubmitLabel}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  spaceRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  titleInput: {
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  messageInput: {
    fontSize: typography.size.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    minHeight: 100,
    maxHeight: 200,
  },

  messageInputFocused: {
    // Can add focus styling here
  },

  messageInputCompact: {
    minHeight: 60,
    maxHeight: 120,
  },
});

export default Composer;
