// =============================================================================
// CREATE POST MODAL - Near-fullscreen post composer with 10tap rich text editor
// =============================================================================
// Uses @10play/tentap-editor (TipTap/ProseMirror) for WYSIWYG editing.
// On submit, HTML is converted to markdown via turndown for server compatibility.
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  RichText,
  useEditorBridge,
  TenTapStartKit,
  PlaceholderBridge,
} from '@10play/tentap-editor';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import {
  BottomSheet,
  BottomSheetFooter,
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
import { Feed } from '@/types/feed';
import { htmlToMarkdown } from '@/utils/htmlToMarkdown';
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

  const initialContent = editFeed
    ? (editFeed.message_rendered || editFeed.message || '')
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
  // 10tap Editor Bridge
  // ---------------------------------------------------------------------------

  const editor = useEditorBridge({
    initialContent,
    autofocus: false,
    avoidIosKeyboard: false, // gorhom bottom sheet handles keyboard
    bridgeExtensions: [
      ...TenTapStartKit,
      PlaceholderBridge.configureExtension({
        placeholder: "What's happening?",
      }),
    ],
  });

  // Inject theme CSS into the editor WebView
  useEffect(() => {
    if (!editor) return;
    editor.injectCSS(`
      body {
        color: ${themeColors.text};
        background: transparent;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 16px;
        line-height: 1.5;
        padding: 0 ${spacing.md}px;
        margin: 0;
      }
      h2 { font-size: 20px; font-weight: 600; margin: 12px 0; color: ${themeColors.text}; }
      h3 { font-size: 18px; font-weight: 600; margin: 8px 0; color: ${themeColors.text}; }
      h4 { font-size: 16px; font-weight: 600; margin: 8px 0; color: ${themeColors.text}; }
      p { margin: 6px 0; }
      a { color: ${themeColors.primary}; text-decoration: underline; }
      blockquote {
        border-left: 3px solid ${themeColors.primary};
        padding-left: 12px;
        margin: 8px 0;
        color: ${themeColors.textSecondary};
        font-style: italic;
      }
      ul, ol { padding-left: 24px; margin: 6px 0; }
      li { margin: 2px 0; }
      code {
        background: ${themeColors.backgroundSecondary};
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 14px;
      }
      pre {
        background: ${themeColors.backgroundSecondary};
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
      }
      pre code { background: none; padding: 0; }
      hr {
        border: none;
        border-top: 1px solid ${themeColors.border};
        margin: 12px 0;
      }
      strong { font-weight: 700; }
      del, s { text-decoration: line-through; }
      .ProseMirror-focused { outline: none; }
      .is-editor-empty:first-child::before {
        color: ${themeColors.textTertiary};
        font-style: normal;
      }
    `, 'theme');
  }, [editor, themeColors]);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [title, setTitle] = useState(initialTitle);
  const [attachments, setAttachments] = useState<MediaItem[]>(initialAttachments);
  const [videoAttachment, setVideoAttachment] = useState<OembedData | null>(initialVideo);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [selectedSpaceSlug, setSelectedSpaceSlug] = useState<string | null>(effectiveSpaceSlug || null);
  const [selectedSpaceName, setSelectedSpaceName] = useState<string | null>(effectiveSpaceName || null);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const showSpaceSelector = !effectiveSpaceSlug && !isEditing;
  const actualSubmitLabel = isEditing ? 'Save' : 'Post';
  const canSubmit = !isSubmitting && !isUploading;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSpaceSelect = (slug: string, name: string) => {
    setSelectedSpaceSlug(slug);
    setSelectedSpaceName(name);
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
    // Get content from the editor
    const html = await editor.getHTML();
    const markdown = htmlToMarkdown(html);
    const plainText = await editor.getText();

    if (!markdown.trim() && attachments.length === 0 && !videoAttachment) return;

    if (!selectedSpaceSlug && !effectiveSpaceSlug) {
      Alert.alert('Select a Space', 'Please select which space to post in.');
      return;
    }

    if (plainText.length > maxLength) {
      Alert.alert('Too Long', `Your post is ${plainText.length} characters. Maximum is ${maxLength}.`);
      return;
    }

    setIsSubmitting(true);
    Keyboard.dismiss();

    try {
      const submitData: ComposerSubmitData = {
        message: markdown,
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
      editor.setContent('');
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
      <BottomSheetFooter {...props} bottomInset={insets.bottom}>
        <View style={[styles.footerInner, { backgroundColor: themeColors.surface }]}>
          <MarkdownToolbar editor={editor} />
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
    [editor, canSubmit, isSubmitting, isUploading, videoAttachment,
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

          {/* Rich Text Editor — 10tap WebView */}
          <View style={styles.editorContainer}>
            <RichText
              editor={editor}
              style={styles.richText}
              scrollEnabled={true}
              nestedScrollEnabled={true}
            />
          </View>

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

  editorContainer: {
    flex: 1,
    minHeight: 200,
  },

  richText: {
    flex: 1,
  },

  footerInner: {
    borderTopWidth: 1,
    borderTopColor: 'transparent',
  },
});

export default CreatePostModal;
