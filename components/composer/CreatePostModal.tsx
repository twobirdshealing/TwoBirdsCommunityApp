// =============================================================================
// CREATE POST MODAL - Full screen post composer
// =============================================================================
// FIXED: Use space SLUG instead of ID
// UPDATED: Uses PageHeader component for consistent styling
// =============================================================================

import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { PageHeader } from '@/components/navigation';
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header - Using PageHeader component */}
          <PageHeader
            leftAction="close"
            onLeftPress={onClose}
            title="Create Post"
          />

          {/* Space indicator - shown when space is pre-selected */}
          {spaceName && (
            <View style={styles.spaceIndicator}>
              <Ionicons name="people-outline" size={16} color={colors.primary} />
              <Text style={styles.spaceText}>Posting to <Text style={styles.spaceName}>{spaceName}</Text></Text>
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles (header styles removed - now in PageHeader component)
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  keyboardView: {
    flex: 1,
  },

  spaceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight + '20',
    gap: spacing.xs,
  },

  spaceText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  spaceName: {
    color: colors.primary,
    fontWeight: '600',
  },

  composerContainer: {
    flex: 1,
  },
});

export default CreatePostModal;
