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
import { spacing, typography, sizing } from '@/constants/layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

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
  const { colors: themeColors } = useTheme();
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
        style={[styles.compactContainer, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}
        onPress={() => {}} // Phase 2: Open full composer modal
        activeOpacity={0.7}
      >
        <Image source={{ uri: userPhoto }} style={styles.compactAvatar} />
        <View style={[styles.compactInput, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.compactPlaceholder, { color: themeColors.textTertiary }]}>{placeholder}</Text>
        </View>
        <View style={[styles.compactButton, { backgroundColor: themeColors.primary }]}>
          <Text style={styles.compactButtonIcon}>✍️</Text>
        </View>
      </TouchableOpacity>
    );
  }

  // Full version - expandable composer
  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
      <View style={styles.row}>
        {/* User Avatar */}
        <Image source={{ uri: userPhoto }} style={styles.avatar} />

        {/* Input */}
        <TextInput
          style={[styles.input, { color: themeColors.text }]}
          placeholder={placeholder}
          placeholderTextColor={themeColors.textTertiary}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={5000}
          editable={!posting}
        />
      </View>

      {/* Actions */}
      {message.trim().length > 0 && (
        <View style={[styles.actions, { borderTopColor: themeColors.border }]}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setMessage('')}
            disabled={posting}
          >
            <Text style={[styles.cancelText, { color: themeColors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.postButton, { backgroundColor: themeColors.primary }, posting && styles.postButtonDisabled]}
            onPress={handlePost}
            disabled={posting}
          >
            {posting ? (
              <ActivityIndicator size="small" color={themeColors.textInverse} />
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
    padding: spacing.md,
    borderBottomWidth: 1,
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
    minHeight: 60,
    textAlignVertical: 'top',
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },

  cancelButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
  },

  cancelText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },

  postButton: {
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
    fontWeight: typography.weight.semibold,
  },

  // Compact Composer
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },

  compactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: spacing.sm,
  },

  compactInput: {
    flex: 1,
    borderRadius: sizing.borderRadius.md,
    padding: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  compactPlaceholder: {
    fontSize: typography.size.md,
  },

  compactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },

  compactButtonIcon: {
    fontSize: 20,
  },
});

export default PostComposer;
