// =============================================================================
// CREATE POST MODAL - Near-fullscreen post composer
// =============================================================================
// FIXED: Use space SLUG instead of ID
// REFACTORED: Uses shared BottomSheet component for cohesive UX
// =============================================================================

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { BottomSheet } from '@/components/common/BottomSheet';
import { Composer, ComposerSubmitData } from './Composer';
import { Feed } from '@/types';
import { MediaItem } from '@/services/api/media';
import { stripHtmlTags } from '@/utils/htmlToText';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: ComposerSubmitData) => Promise<void>;
  spaceSlug?: string;  // SLUG not ID!
  spaceName?: string;
  editFeed?: Feed;     // When provided, opens in edit mode
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
  const isEditing = !!editFeed;

  // Extract initial values from feed being edited
  const initialMessage = editFeed
    ? (editFeed.message || stripHtmlTags(editFeed.message_rendered))
    : undefined;
  const initialTitle = editFeed?.title || undefined;

  // Convert existing media_items to MediaItem format for the Composer
  const initialAttachments: MediaItem[] | undefined = editFeed?.meta?.media_items
    ? editFeed.meta.media_items
        .filter(item => item.type === 'image')
        .map(item => ({
          media_id: item.media_id,
          url: item.url,
          type: 'image' as const,
          width: item.width || 0,
          height: item.height || 0,
        }))
    : undefined;

  // Extract video embed if present
  const initialVideo = editFeed?.meta?.media_preview?.provider === 'youtube'
    ? {
        url: editFeed.meta.media_preview.url || '',
        title: editFeed.meta.media_preview.title || '',
        image: editFeed.meta.media_preview.image || '',
        provider: 'youtube',
        type: 'video',
        content_type: 'video',
      }
    : undefined;

  // Resolve space slug: editing uses the feed's space, creating uses the prop
  const effectiveSpaceSlug = isEditing ? editFeed.space?.slug : spaceSlug;
  const effectiveSpaceName = isEditing ? editFeed.space?.title : spaceName;

  const handleSubmit = async (data: ComposerSubmitData) => {
    await onSubmit(data);
    onClose();
  };

  // If space is pre-selected, ensure the space slug is in submit data
  const handleSubmitWithSpace = async (data: ComposerSubmitData) => {
    const finalData = effectiveSpaceSlug
      ? { ...data, space: effectiveSpaceSlug }
      : data;

    console.log(`[CreatePostModal] ${isEditing ? 'Updating' : 'Submitting'}:`, JSON.stringify(finalData, null, 2));
    await handleSubmit(finalData);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightMode="percentage"
      heightPercentage={95}
      title={isEditing ? 'Edit Post' : 'Create Post'}
      keyboardAvoiding
    >
      {/* Space indicator - shown when space is pre-selected */}
      {effectiveSpaceName && (
        <View style={styles.spaceIndicator}>
          <Ionicons name="people-outline" size={16} color={themeColors.primary} />
          <Text style={[styles.spaceText, { color: themeColors.textSecondary }]}>{isEditing ? 'Editing in' : 'Posting to'} <Text style={[styles.spaceName, { color: themeColors.primary }]}>{effectiveSpaceName}</Text></Text>
        </View>
      )}

      {/* Composer */}
      <View style={styles.composerContainer}>
        <Composer
          key={editFeed ? `edit-${editFeed.id}` : 'create'}
          mode="feed"
          placeholder="What's happening?"
          autoFocus={true}
          initialSpaceSlug={effectiveSpaceSlug}
          initialSpaceName={effectiveSpaceName}
          initialMessage={initialMessage}
          initialTitle={initialTitle}
          initialAttachments={initialAttachments}
          initialVideo={initialVideo}
          isEditMode={isEditing}
          onSubmit={handleSubmitWithSpace}
          onCancel={onClose}
        />
      </View>
    </BottomSheet>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  spaceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },

  spaceText: {
    fontSize: typography.size.sm,
  },

  spaceName: {
    fontWeight: '600',
  },

  composerContainer: {
    flex: 1,
  },
});

export default CreatePostModal;
