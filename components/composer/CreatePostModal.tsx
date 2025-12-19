// =============================================================================
// CREATE POST MODAL - Full screen post composer
// =============================================================================
// Modal that shows when user taps QuickPostBox
// UPDATED: Properly passes space pre-selection to Composer
// =============================================================================

import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/colors';
import { spacing, typography } from '@/constants/layout';
import { Composer, ComposerSubmitData } from './Composer';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CreatePostModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: ComposerSubmitData) => Promise<void>;
  spaceId?: number;
  spaceName?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CreatePostModal({
  visible,
  onClose,
  onSubmit,
  spaceId,
  spaceName,
}: CreatePostModalProps) {
  
  const handleSubmit = async (data: ComposerSubmitData) => {
    await onSubmit(data);
    onClose();
  };

  // If space is pre-selected, override the space_id in submit data
  const handleSubmitWithSpace = async (data: ComposerSubmitData) => {
    const finalData = spaceId 
      ? { ...data, space_id: spaceId }
      : data;
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
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
            
            <Text style={styles.headerTitle}>Create Post</Text>
            
            {/* Spacer for alignment */}
            <View style={styles.headerSpacer} />
          </View>

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
              initialSpaceId={spaceId}
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
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  keyboardView: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },

  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: '600',
    color: colors.text,
  },

  headerSpacer: {
    width: 40,
  },

  spaceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primaryLight + '20',
    gap: spacing.xs,
  },

  spaceText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  spaceName: {
    fontWeight: '600',
    color: colors.primary,
  },

  composerContainer: {
    flex: 1,
    padding: spacing.md,
  },
});

export default CreatePostModal;
