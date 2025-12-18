// =============================================================================
// CREATE POST MODAL - Full screen post composer
// =============================================================================
// Modal that shows when user taps QuickPostBox
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

          {/* Space indicator */}
          {spaceName && (
            <View style={styles.spaceIndicator}>
              <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.spaceText}>Posting to {spaceName}</Text>
            </View>
          )}

          {/* Composer */}
          <View style={styles.composerContainer}>
            <Composer
              mode="feed"
              placeholder="What's happening?"
              submitLabel="Post"
              autoFocus={true}
              spaceId={spaceId}
              onSubmit={handleSubmit}
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
    backgroundColor: colors.backgroundSecondary,
    gap: spacing.xs,
  },

  spaceText: {
    fontSize: typography.size.sm,
    color: colors.textSecondary,
  },

  composerContainer: {
    flex: 1,
    padding: spacing.md,
  },
});

export default CreatePostModal;
