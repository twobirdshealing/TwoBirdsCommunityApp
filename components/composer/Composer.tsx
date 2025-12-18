// =============================================================================
// COMPOSER - Reusable content creation component
// =============================================================================
// Used for: Creating feeds, comments, replies
// Supports: Text, emojis, image attachments
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
  
  // For feeds
  spaceId?: number;
  
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
  spaceId,
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
    comment: 'Post Comment',
    reply: 'Reply',
  }[mode];

  const showTitle = mode === 'feed';
  const showToolbar = true;
  
  // ---------------------------------------------------------------------------
  // Image Picker
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

      // Pick image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

      // Add space_id for feeds
      if (mode === 'feed' && spaceId) {
        submitData.space_id = spaceId;
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

  const canSubmit = (message.trim().length > 0 || attachments.length > 0) && !isSubmitting && !isUploading;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.container}>
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
            // For now, show a simple emoji picker hint
            // Can expand to full emoji picker later
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
    minHeight: 80,
    maxHeight: 200,
  },

  messageInputFocused: {
    // Can add focus styling here
  },
});

export default Composer;
