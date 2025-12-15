// =============================================================================
// POST COMPOSER - Inline post creation box
// =============================================================================
// Reusable "What's happening?" style composer
// Used on: Home feed, Space pages, Profile
// =============================================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { colors } from '@/constants/colors';
import { spacing, typography, sizing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';

interface PostComposerProps {
  placeholder?: string;
  spaceId?: number;
  onPost?: (message: string) => Promise<void>;
  compact?: boolean;
}

export function PostComposer({
  placeholder = "What's happening?",
  spaceId,
  onPost,
  compact = false,
}: PostComposerProps) {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handlePost = async () => {
    if (!message.trim() || posting) return;

    setPosting(true);
    try {
      if (onPost) {
        await onPost(message);
        setMessage(''); // Clear on success
      }
    } catch (err) {
      // Error handling in parent
      console.error('Post failed:', err);
    } finally {
      setPosting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const userPhoto = user?.photo || 'https://ui-avatars.com/api/?name=User&size=128';

  if (compact) {
    // Compact version - single line
    return (
      <TouchableOpacity 
        style={styles.compactContainer}
        onPress={() => {}} // Phase 2: Open full composer modal
        activeOpacity={0.7}
      >
        <Image source={{ uri: userPhoto }} style={styles.compactAvatar} />
        <View style={styles.compactInput}>
          <Text style={styles.compactPlaceholder}>{placeholder}</Text>
        </View>
        <View style={styles.compactButton}>
          <Text style={styles.compactButtonIcon}>✍️</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Full version - expandable composer
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* User Avatar */}
        <Image source={{ uri: userPhoto }} style={styles.avatar} />

        {/* Input */}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={5000}
          editable={!posting}
        />
      </View>

      {/* Actions */}
      {message.trim().length > 0 && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setMessage('')}
            disabled={posting}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.postButton, posting && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color={colors.textInverse} />
            ) : (
              <Text style={styles.postText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Full Composer
  container: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  row: {
    flexDirection: 'row',
  },

  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.md,
  },

  input: {
    flex: 1,
    fontSize: typography.size.md,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  cancelButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },

  cancelText: {
    fontSize: typography.size.md,
    color: colors.textSecondary,
    fontWeight: typography.weight.medium,
  },

  postButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: sizing.borderRadius.md,
    minWidth: 80,
    alignItems: 'center',
  },

  postButtonDisabled: {
    opacity: 0.6,
  },

  postText: {
    fontSize: typography.size.md,
    color: colors.textInverse,
    fontWeight: typography.weight.semibold,
  },

  // Compact Composer
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  compactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: spacing.sm,
  },

  compactInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: sizing.borderRadius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  compactPlaceholder: {
    fontSize: typography.size.md,
    color: colors.textTertiary,
  },

  compactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },

  compactButtonIcon: {
    fontSize: 20,
  },
});

export default PostComposer;
