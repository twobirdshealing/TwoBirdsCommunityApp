// =============================================================================
// CREATE POST MODAL - Near-fullscreen post composer
// =============================================================================
// All state managed directly here (same pattern as CommentSheet) so toolbars
// can be rendered in a gorhom footer for proper keyboard handling.
// =============================================================================

import React, { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MarkdownTextInput from '@expensify/react-native-live-markdown/src/MarkdownTextInput';
import { parseMarkdown } from '@/utils/markdownParser';
import { getMarkdownStyle } from '@/constants/markdownStyle';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import {
  BottomSheet,
  BottomSheetFooter,
  SheetInput,
} from '@/components/common/BottomSheet';
import type { BottomSheetFooterProps } from '@/components/common/BottomSheet';
import { ComposerToolbar } from './ComposerToolbar';
import { MarkdownToolbar } from './MarkdownToolbar';
import { SpaceSelector } from './SpaceSelector';
import { MediaPreview } from './MediaPreview';
import { VideoAttachModal } from './VideoAttachModal';
import { VideoPreview } from './VideoPreview';
import { MediaItem, mediaApi } from '@/services/api/media';
import { OembedData } from '@/services/api/feeds';
import { type FormatResult } from '@/utils/markdown';
import { Feed } from '@/types/feed';
import { stripHtmlTags } from '@/utils/htmlToText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ComposerSubmitData {
  message: string;
  title?: string;
  content_type: 'text' | 'markdown';
  space?: string;
  media_images?: Array<{
    url: string;
    type: string;
    width: number;
    height: number;
    provider: string;
  }>;
  media?: {
    type: 'oembed';
    url: string;
  };
  parent_id?: number;
  meta?: Record<string, any>;
}

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: ComposerSubmitData) => Promise<void>;
  spaceSlug?: string;
  spaceName?: string;
  editFeed?: Feed;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CreatePostModal({
  visible,
  onClose,
  onSubmit,
  spaceSlug,
  spaceName,
  editFeed,
}: CreatePostModalProps) {
  const { colors: themeColors } = useTheme();
  const insets = useSafeAreaInsets();
  const isEditing = !!editFeed;
  const maxLength = 5000;

  // ---------------------------------------------------------------------------
  // Initial values from edit feed
  // ---------------------------------------------------------------------------

  const initialMessage = editFeed
    ? (editFeed.message || stripHtmlTags(editFeed.message_rendered))
    : '';
  const initialTitle = editFeed?.title || '';
  const initialAttachments: MediaItem[] = editFeed?.meta?.media_items
    ? editFeed.meta.media_items
        .filter(item => item.type === 'image')
        .map(item => ({
          media_id: item.media_id,
          url: item.url,
          type: 'image' as const,
          width: item.width || 0,
          height: item.height || 0,
        }))
    : [];
  const initialVideo = editFeed?.meta?.media_preview?.provider === 'youtube'
    ? {
        url: editFeed.meta.media_preview.url || '',
        title: editFeed.meta.media_preview.title || '',
        image: editFeed.meta.media_preview.image || '',
        provider: 'youtube',
        type: 'video',
        content_type: 'video',
      }
    : null;

  const effectiveSpaceSlug = isEditing ? editFeed.space?.slug : spaceSlug;
  const effectiveSpaceName = isEditing ? editFeed.space?.title : spaceName;

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [message, setMessage] = useState(initialMessage);
  const [title, setTitle] = useState(initialTitle);
  const [attachments, setAttachments] = useState<MediaItem[]>(initialAttachments);
  const [videoAttachment, setVideoAttachment] = useState<OembedData | null>(initialVideo);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [selectedSpaceSlug, setSelectedSpaceSlug] = useState<string | null>(effectiveSpaceSlug || null);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string | null>(effectiveSpaceName || null);

  const inputRef = useRef<TextInput>(null);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const showSpaceSelector = !effectiveSpaceSlug && !isEditing;
  const actualSubmitLabel = isEditing ? 'Save' : 'Post';
  const charCount = message.length;
  const isOverLimit = charCount > maxLength;
  const showCharCount = charCount > maxLength * 0.8;

  const canSubmit =
    !isSubmitting &&
    !isUploading &&
    !isOverLimit &&
    (message.trim().length > 0 || attachments.length > 0 || videoAttachment !== null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSpaceSelect = (slug: string, name: string) => {
    setSelectedSpaceSlug(slug);
    setSelectedSpaceName(name);
  };

  const handleFormat = (result: FormatResult) => {
    setMessage(result.text);
    setTimeout(() => setSelection(result.selection), 0);
  };

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

      if (result.canceled || !result.assets?.length) return;

      setIsUploading(true);

      for (const asset of result.assets) {
        const fileName = asset.uri.split('/').pop() || 'image.jpg';
        const fileType = asset.mimeType || 'image/jpeg';

        const response = await mediaApi.uploadMedia(asset.uri, fileType, fileName, 'feed');

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
      if (__DEV__) console.error('Image picker error:', error);
      Alert.alert('Error', 'Failed to pick image');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleVideoPress = () => setShowVideoModal(true);

  const handleVideoAttach = (data: OembedData) => {
    setVideoAttachment(data);
    setAttachments([]);
  };

  const handleVideoRemove = () => setVideoAttachment(null);

  const handleSubmit = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage && attachments.length === 0 && !videoAttachment) return;

    if (!selectedSpaceSlug && !effectiveSpaceSlug) {
      Alert.alert('Select a Space', 'Please select which space to post in.');
      return;
    }

    setIsSubmitting(true);
    Keyboard.dismiss();

    try {
      const submitData: ComposerSubmitData = {
        message: trimmedMessage,
        content_type: 'markdown',
        space: effectiveSpaceSlug || selectedSpaceSlug || undefined,
      };

      if (title.trim()) {
        submitData.title = title.trim();
      }

      if (attachments.length > 0) {
        submitData.media_images = attachments.map(item => ({
          url: item.url,
          type: 'image',
          width: 0,
          height: 0,
          provider: 'uploader',
        }));
      }

      if (videoAttachment) {
        submitData.media = { type: 'oembed', url: videoAttachment.url };
      }

      await onSubmit(submitData);

      // Clear form on success
      setMessage('');
      setTitle('');
      setAttachments([]);
      setVideoAttachment(null);
      onClose();
    } catch (error) {
      if (__DEV__) console.error('Submit error:', error);
      Alert.alert('Error', 'Failed to post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Footer — MarkdownToolbar + ComposerToolbar pinned above keyboard
  // ---------------------------------------------------------------------------

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View style={[styles.footerInner, { backgroundColor: themeColors.surface, paddingBottom: insets.bottom }]}>
          <MarkdownToolbar
            text={message}
            selection={selection}
            onFormat={handleFormat}
          />
          <ComposerToolbar
            onImagePress={handleImagePicker}
            onVideoPress={handleVideoPress}
            onSubmit={handleSubmit}
            submitLabel={actualSubmitLabel}
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
            isUploading={isUploading}
            hasVideo={videoAttachment !== null}
          />
        </View>
      </BottomSheetFooter>
    ),
    [message, selection, canSubmit, isSubmitting, isUploading, videoAttachment,
     actualSubmitLabel, themeColors, insets.bottom],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title={isEditing ? 'Edit Post' : 'Create Post'}
        footerComponent={renderFooter}
      >
        <View style={[styles.content, { backgroundColor: themeColors.surface }]}>
          {/* Space indicator or selector */}
          {effectiveSpaceName ? (
            <View style={[styles.spaceIndicator, { borderBottomColor: themeColors.border }]}>
              <Ionicons name="people-outline" size={16} color={themeColors.primary} />
              <Text style={[styles.spaceText, { color: themeColors.textSecondary }]}>
                {isEditing ? 'Editing in' : 'Posting to'}{' '}
                <Text style={[styles.spaceName, { color: themeColors.primary }]}>{effectiveSpaceName}</Text>
              </Text>
            </View>
          ) : showSpaceSelector ? (
            <View style={[styles.spaceRow, { borderBottomColor: themeColors.border }]}>
              <SpaceSelector
                selectedSpaceSlug={selectedSpaceSlug}
                selectedSpaceName={selectedSpaceName}
                onSelect={handleSpaceSelect}
              />
            </View>
          ) : null}

          {/* Title Input */}
          <TextInput
            style={[styles.titleInput, { color: themeColors.text, borderBottomColor: themeColors.border }]}
            placeholder="Title (optional)"
            placeholderTextColor={themeColors.textTertiary}
            value={title}
            onChangeText={setTitle}
            maxLength={200}
          />

          {/* Message Input — SheetInput registers with gorhom keyboard system */}
          <SheetInput>
            {(sheetProps) => (
              <MarkdownTextInput
                ref={(node: any) => {
                  inputRef.current = node;
                  sheetProps.ref.current = node;
                }}
                style={[
                  styles.messageInput,
                  { color: themeColors.text },
                  isFocused && styles.messageInputFocused,
                ]}
                placeholder="What's happening?"
                placeholderTextColor={themeColors.textTertiary}
                value={message}
                onChangeText={setMessage}
                onFocus={(e: any) => { sheetProps.onFocus(e); setIsFocused(true); }}
                onBlur={(e: any) => { sheetProps.onBlur(e); setIsFocused(false); }}
                multiline
                autoFocus={false}
                maxLength={maxLength + 100}
                selection={selection}
                onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
                parser={parseMarkdown}
                markdownStyle={getMarkdownStyle(themeColors)}
              />
            )}
          </SheetInput>

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
            <Text style={[styles.charCount, { color: themeColors.textTertiary }, isOverLimit && styles.charCountOver]}>
              {charCount}/{maxLength}
            </Text>
          )}
        </View>
      </BottomSheet>

      {/* Video Attach Modal */}
      <VideoAttachModal
        visible={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        onAttach={handleVideoAttach}
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },

  spaceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.xs,
  },

  spaceText: {
    fontSize: typography.size.sm,
  },

  spaceName: {
    fontWeight: '600',
  },

  spaceRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },

  titleInput: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },

  messageInput: {
    flex: 1,
    fontSize: typography.size.md,
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
    textAlign: 'right',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },

  charCountOver: {
  },

  footerInner: {
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
});

export default CreatePostModal;
