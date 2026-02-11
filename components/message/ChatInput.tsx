// =============================================================================
// CHAT INPUT - Message composer for chat screen
// =============================================================================
// Text input with send button and optional image attachments
// =============================================================================

import { MediaPreview } from '@/components/composer/MediaPreview';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { MediaItem, mediaApi } from '@/services/api/media';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ChatInputAttachment {
  url: string;
  type: 'image';
  width?: number;
  height?: number;
}

interface ChatInputProps {
  onSend: (text: string, attachments?: ChatInputAttachment[]) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
  sending?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ChatInput({
  onSend,
  placeholder = 'Type a message...',
  disabled = false,
  sending = false,
}: ChatInputProps) {
  const { colors: themeColors } = useTheme();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MediaItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const canSend = (text.trim().length > 0 || attachments.length > 0) && !disabled && !sending && !isUploading;

  // ---------------------------------------------------------------------------
  // Handle Image Picker
  // ---------------------------------------------------------------------------

  const handleImagePicker = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos to send images.');
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
          'chat'
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
      console.error('[ChatInput] Image picker error:', error);
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
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSend = async () => {
    if (!canSend) return;

    const messageText = text.trim();
    const messageAttachments: ChatInputAttachment[] = attachments.map(a => ({
      url: a.url,
      type: 'image' as const,
      width: a.width,
      height: a.height,
    }));

    // Clear immediately for better UX
    setText('');
    setAttachments([]);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      await onSend(messageText, messageAttachments.length > 0 ? messageAttachments : undefined);
    } catch (error) {
      // Restore on error
      setText(messageText);
      // Note: Attachments are not restored as they've been uploaded
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.wrapper, { backgroundColor: themeColors.surface, borderTopColor: themeColors.border }]}>
      {/* Media Preview */}
      {(attachments.length > 0 || isUploading) && (
        <MediaPreview
          items={attachments}
          onRemove={removeAttachment}
          isUploading={isUploading}
        />
      )}

      <View style={[styles.container, { backgroundColor: themeColors.surface }]}>
        {/* Image Picker Button */}
        <Pressable
          style={styles.attachButton}
          onPress={handleImagePicker}
          disabled={disabled || sending || attachments.length >= 4}
        >
          <Ionicons
            name="image-outline"
            size={24}
            color={attachments.length >= 4 ? themeColors.textTertiary : themeColors.textSecondary}
          />
        </Pressable>

        <View style={[styles.inputContainer, { backgroundColor: themeColors.backgroundSecondary }]}>
          <TextInput
            style={[styles.input, { color: themeColors.text }]}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={themeColors.textTertiary}
            multiline
            maxLength={2000}
            editable={!disabled && !sending}
            returnKeyType="default"
          />
        </View>

        <Pressable
          style={[
            styles.sendButton,
            { backgroundColor: themeColors.backgroundSecondary },
            canSend && [styles.sendButtonActive, { backgroundColor: themeColors.primary }],
          ]}
          onPress={handleSend}
          disabled={!canSend}
        >
          {sending ? (
            <ActivityIndicator size="small" color={themeColors.textInverse} />
          ) : (
            <Ionicons
              name="send"
              size={20}
              color={canSend ? themeColors.textInverse : themeColors.textTertiary}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
  },

  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  attachButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  inputContainer: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 0,
    marginRight: spacing.sm,
    maxHeight: 120,
  },

  input: {
    fontSize: typography.size.md,
    lineHeight: 20,
    minHeight: 24,
    maxHeight: 100,
    paddingTop: Platform.OS === 'android' ? spacing.xs : 0,
    paddingBottom: Platform.OS === 'android' ? spacing.xs : 0,
  },

  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  sendButtonActive: {
  },
});

export default ChatInput;
