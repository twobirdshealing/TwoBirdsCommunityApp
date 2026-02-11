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

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: ComposerSubmitData) => Promise<void>;
  spaceSlug?: string;  // SLUG not ID!
  spaceName?: string;
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
}: CreatePostModalProps) {
  const { colors: themeColors } = useTheme();

  const handleSubmit = async (data: ComposerSubmitData) => {
    await onSubmit(data);
    onClose();
  };

  // If space is pre-selected, ensure the space slug is in submit data
  const handleSubmitWithSpace = async (data: ComposerSubmitData) => {
    const finalData = spaceSlug
      ? { ...data, space: spaceSlug }
      : data;

    console.log('[CreatePostModal] Submitting:', JSON.stringify(finalData, null, 2));
    await handleSubmit(finalData);
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      heightMode="percentage"
      heightPercentage={95}
      title="Create Post"
      keyboardAvoiding
    >
      {/* Space indicator - shown when space is pre-selected */}
      {spaceName && (
        <View style={styles.spaceIndicator}>
          <Ionicons name="people-outline" size={16} color={themeColors.primary} />
          <Text style={[styles.spaceText, { color: themeColors.textSecondary }]}>Posting to <Text style={[styles.spaceName, { color: themeColors.primary }]}>{spaceName}</Text></Text>
        </View>
      )}

      {/* Composer */}
      <View style={styles.composerContainer}>
        <Composer
          mode="feed"
          placeholder="What's happening?"
          submitLabel="Post"
          autoFocus={true}
          initialSpaceSlug={spaceSlug}
          initialSpaceName={spaceName}
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
