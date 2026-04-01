import React, { useState } from 'react';
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { RichText } from '@10play/tentap-editor';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { PageHeader, HeaderTitle } from '@/components/navigation/PageHeader';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { useThemedEditor } from '@/hooks/useThemedEditor';
import { ComposerToolbar } from './ComposerToolbar';
import { MarkdownToolbar } from './MarkdownToolbar';
import { SpaceSelector } from './SpaceSelector';
import { MediaPreview } from './MediaPreview';
import { VideoAttachModal } from './VideoAttachModal';
import { VideoPreview } from './VideoPreview';
import { GifPickerModal } from './GifPickerModal';
import { GifPreview } from './GifPreview';
import { PollBuilderSheet } from './PollBuilderSheet';
import { PollPreview } from './PollPreview';
import type { PollData } from './PollBuilderSheet';
import { MediaItem, mediaApi } from '@/services/api/media';
import { OembedData } from '@/services/api/feeds';
import { Feed } from '@/types/feed';
import { GifAttachment } from '@/types/gif';
import { htmlToMarkdown } from '@/utils/htmlToMarkdown';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { createLogger } from '@/utils/logger';

const log = createLogger('CreatePost');

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
  survey?: {
    type: 'single_choice' | 'multi_choice';
    options: { label: string; slug: string }[];
    end_date: string;
  };
}

interface CreatePostContentProps {
  onClose: () => void;
  onSubmit: (data: ComposerSubmitData) => Promise<void>;
  spaceSlug?: string;
  spaceName?: string;
  editFeed?: Feed;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CreatePostContent({
  onClose,
  onSubmit,
  spaceSlug,
  spaceName,
  editFeed,
}: CreatePostContentProps) {
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
  const initialGif: GifAttachment | null = editFeed?.meta?.media_preview?.provider === 'giphy'
    ? {
        image: editFeed.meta.media_preview.image || '',
        width: editFeed.meta.media_preview.width || 0,
        height: editFeed.meta.media_preview.height || 0,
        previewUrl: editFeed.meta.media_preview.image || '',
      }
    : null;

  const initialPoll: PollData | null =
    editFeed?.content_type === 'survey' && editFeed?.meta?.survey_config
      ? {
          type: editFeed.meta.survey_config.type,
          options: editFeed.meta.survey_config.options.map(o => o.label),
          end_date: editFeed.meta.survey_config.end_date || '',
        }
      : null;

  const effectiveSpaceSlug = isEditing ? editFeed.space?.slug : spaceSlug;
  const effectiveSpaceName = isEditing ? editFeed.space?.title : spaceName;

  // ---------------------------------------------------------------------------
  // 10tap Editor Bridge
  // ---------------------------------------------------------------------------

  const editor = useThemedEditor({
    placeholder: "What's happening?",
    initialContent,
  });

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const [title, setTitle] = useState(initialTitle);
  const [attachments, setAttachments] = useState<MediaItem[]>(initialAttachments);
  const [videoAttachment, setVideoAttachment] = useState<OembedData | null>(initialVideo);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [gifAttachment, setGifAttachment] = useState<GifAttachment | null>(initialGif);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [pollData, setPollData] = useState<PollData | null>(initialPoll);
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
      log.error('Image picker error:', error);
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
  };

  const handleVideoRemove = () => setVideoAttachment(null);

  const handleGifPress = () => setShowGifPicker(true);

  const handleGifSelect = (gif: GifAttachment) => {
    setGifAttachment(gif);
  };

  const handleGifRemove = () => setGifAttachment(null);

  const [showPollSheet, setShowPollSheet] = useState(false);

  const handlePollPress = () => {
    if (pollData) {
      // Already have a poll — open sheet to edit it
      setShowPollSheet(true);
    } else {
      // No poll yet — open sheet to create one
      setShowPollSheet(true);
    }
  };

  const handlePollDone = (data: PollData) => {
    setPollData(data);
  };

  const handlePollRemove = () => setPollData(null);

  const handleSubmit = async () => {
    const html = await editor.getHTML();
    const markdown = htmlToMarkdown(html);
    const plainText = await editor.getText();

    if (!markdown.trim() && attachments.length === 0 && !videoAttachment && !gifAttachment && !pollData) return;

    // Validate poll options if poll is active
    if (pollData) {
      const filledOptions = pollData.options.filter(o => o.trim());
      if (filledOptions.length < 2) {
        Alert.alert('Poll Error', 'Please add at least 2 poll options.');
        return;
      }
    }

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

      if (gifAttachment) {
        submitData.meta = {
          media_preview: {
            image: gifAttachment.image,
            type: 'image',
            provider: 'inline', // Server converts 'inline' to 'giphy' on save
            width: gifAttachment.width,
            height: gifAttachment.height,
          },
        };
      }

      if (pollData) {
        const filledOptions = pollData.options.filter(o => o.trim());
        submitData.survey = {
          type: pollData.type,
          options: filledOptions.map((label, i) => ({
            label: label.trim(),
            slug: `opt_${i + 1}`,
          })),
          end_date: pollData.end_date,
        };
      }

      await onSubmit(submitData);

      editor.setContent('');
      setTitle('');
      setAttachments([]);
      setVideoAttachment(null);
      setGifAttachment(null);
      setPollData(null);
      onClose();
    } catch (error) {
      log.error('Submit error:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: themeColors.surface }]} edges={['top']}>
        {/* Header */}
        <PageHeader left={<HeaderIconButton icon="close" onPress={onClose} />} center={<HeaderTitle>{isEditing ? 'Edit Post' : 'Create Post'}</HeaderTitle>} />

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

        {/* Rich text editor */}
        <RichText editor={editor} />
      </SafeAreaView>

      {/* Toolbar — sticks above keyboard (10tap docs pattern) */}
      <KeyboardAvoidingView
        behavior="padding"
        style={[styles.keyboardToolbar, { bottom: insets.bottom }]}
      >
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

        {/* GIF Preview */}
        {gifAttachment && (
          <GifPreview
            gif={gifAttachment}
            onRemove={handleGifRemove}
          />
        )}

        {/* Poll Preview */}
        {pollData && (
          <PollPreview
            data={pollData}
            onEdit={() => setShowPollSheet(true)}
            onRemove={handlePollRemove}
          />
        )}

        <View style={[styles.toolbarArea, { borderTopColor: themeColors.border, backgroundColor: themeColors.surface }]}>
          <MarkdownToolbar editor={editor} />
          <ComposerToolbar
            onImagePress={handleImagePicker}
            onVideoPress={handleVideoPress}
            onGifPress={handleGifPress}
            onPollPress={handlePollPress}
            onSubmit={handleSubmit}
            submitLabel={actualSubmitLabel}
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
            isUploading={isUploading}
            hasVideo={videoAttachment !== null}
            hasGif={gifAttachment !== null}
            hasPoll={pollData !== null}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Video Attach Modal */}
      <VideoAttachModal
        visible={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        onAttach={handleVideoAttach}
      />

      {/* GIF Picker Modal */}
      <GifPickerModal
        visible={showGifPicker}
        onClose={() => setShowGifPicker(false)}
        onSelect={handleGifSelect}
      />

      {/* Poll Builder Sheet */}
      <PollBuilderSheet
        visible={showPollSheet}
        onClose={() => setShowPollSheet(false)}
        onDone={handlePollDone}
        initialData={pollData}
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
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
    fontWeight: typography.weight.semibold,
  },

  spaceRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },

  titleInput: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },

  keyboardToolbar: {
    position: 'absolute',
    width: '100%',
    bottom: 0,
  },

  toolbarArea: {
    borderTopWidth: 1,
  },
});

export default CreatePostContent;
