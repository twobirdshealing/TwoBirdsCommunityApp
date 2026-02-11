// =============================================================================
// COMPOSER TOOLBAR - Bottom toolbar with action buttons
// =============================================================================

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ComposerToolbarProps {
  onImagePress: () => void;
  onVideoPress?: () => void;
  onEmojiPress?: () => void;
  onSubmit: () => void;
  isUploading: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  submitLabel: string;
  hasVideo?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ComposerToolbar({
  onImagePress,
  onVideoPress,
  onEmojiPress,
  onSubmit,
  isUploading,
  isSubmitting,
  canSubmit,
  submitLabel,
  hasVideo,
}: ComposerToolbarProps) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, { borderTopColor: themeColors.border, backgroundColor: themeColors.backgroundSecondary }]}>
      {/* Left: Action Buttons */}
      <View style={styles.actions}>
        {/* Image Picker */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onImagePress}
          disabled={isUploading || hasVideo}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={themeColors.primary} />
          ) : (
            <Ionicons
              name="image-outline"
              size={24}
              color={hasVideo ? themeColors.textTertiary : themeColors.textSecondary}
            />
          )}
        </TouchableOpacity>

        {/* Video Picker */}
        {onVideoPress && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onVideoPress}
            disabled={hasVideo}
          >
            <Ionicons
              name="videocam-outline"
              size={24}
              color={hasVideo ? themeColors.primary : themeColors.textSecondary}
            />
          </TouchableOpacity>
        )}

        {/* Emoji Hint */}
        {onEmojiPress && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onEmojiPress}
          >
            <Ionicons
              name="happy-outline"
              size={24}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Right: Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          { backgroundColor: themeColors.primary },
          !canSubmit && styles.submitButtonDisabled,
        ]}
        onPress={onSubmit}
        disabled={!canSubmit}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.submitText}>{submitLabel}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  actionButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },

  submitButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },

  submitButtonDisabled: {
    opacity: 0.6,
  },

  submitText: {
    color: '#fff',
    fontSize: typography.size.sm,
    fontWeight: '600',
  },
});

export default ComposerToolbar;
