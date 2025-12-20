// =============================================================================
// CREATE POST MODAL - Full screen post composer
// =============================================================================
// FIXED: Use space SLUG instead of ID
// Native web app uses: {"space": "book-club"} NOT {"space_id": 50}
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
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  keyboardView: {
    flex: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
