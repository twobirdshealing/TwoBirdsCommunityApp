// =============================================================================
// COMPOSER TOOLBAR - Bottom toolbar with action buttons
// =============================================================================

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { hapticLight, hapticMedium } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ComposerToolbarProps {
  onImagePress: () => void;
  onVideoPress?: () => void;
  onGifPress?: () => void;
  onPollPress?: () => void;
  onEmojiPress?: () => void;
  onSubmit: () => void;
  isUploading: boolean;
  isSubmitting: boolean;
  canSubmit: boolean;
  submitLabel: string;
  hasVideo?: boolean;
  hasGif?: boolean;
  hasPoll?: boolean;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ComposerToolbar({
  onImagePress,
  onVideoPress,
  onGifPress,
  onPollPress,
  onEmojiPress,
  onSubmit,
  isUploading,
  isSubmitting,
  canSubmit,
  submitLabel,
  hasVideo,
  hasGif,
  hasPoll,
}: ComposerToolbarProps) {
  const { colors: themeColors } = useTheme();

  return (
    <View style={[styles.container, { borderTopColor: themeColors.border, backgroundColor: themeColors.backgroundSecondary }]}>
      {/* Left: Action Buttons */}
      <View style={styles.actions}>
        {/* Image Picker */}
        <AnimatedPressable
          style={styles.actionButton}
          onPress={() => { hapticLight(); onImagePress(); }}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color={themeColors.primary} />
          ) : (
            <Ionicons
              name="image-outline"
              size={24}
              color={themeColors.textSecondary}
            />
          )}
        </AnimatedPressable>

        {/* GIF Picker */}
        {onGifPress && (
          <AnimatedPressable
            style={styles.actionButton}
            onPress={() => { hapticLight(); onGifPress(); }}
          >
            <Text style={[
              styles.gifBadge,
              { color: hasGif ? themeColors.primary : themeColors.textSecondary,
                borderColor: hasGif ? themeColors.primary : themeColors.textSecondary },
            ]}>GIF</Text>
          </AnimatedPressable>
        )}

        {/* Poll */}
        {onPollPress && (
          <AnimatedPressable
            style={styles.actionButton}
            onPress={() => { hapticLight(); onPollPress(); }}
          >
            <Ionicons
              name={hasPoll ? 'stats-chart' : 'stats-chart-outline'}
              size={22}
              color={hasPoll ? themeColors.primary : themeColors.textSecondary}
            />
          </AnimatedPressable>
        )}

        {/* Video Picker */}
        {onVideoPress && (
          <AnimatedPressable
            style={styles.actionButton}
            onPress={() => { hapticLight(); onVideoPress?.(); }}
          >
            <Ionicons
              name="videocam-outline"
              size={24}
              color={hasVideo ? themeColors.primary : themeColors.textSecondary}
            />
          </AnimatedPressable>
        )}

        {/* Emoji Hint */}
        {onEmojiPress && (
          <AnimatedPressable
            style={styles.actionButton}
            onPress={onEmojiPress}
          >
            <Ionicons
              name="happy-outline"
              size={24}
              color={themeColors.textSecondary}
            />
          </AnimatedPressable>
        )}
      </View>

      {/* Right: Submit Button */}
      <AnimatedPressable
        style={[
          styles.submitButton,
          { backgroundColor: themeColors.primary },
          !canSubmit && styles.submitButtonDisabled,
        ]}
        onPress={() => { hapticMedium(); onSubmit(); }}
        disabled={!canSubmit}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={themeColors.textInverse} />
        ) : (
          <Text style={[styles.submitText, { color: themeColors.textInverse }]}>{submitLabel}</Text>
        )}
      </AnimatedPressable>
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

  gifBadge: {
    fontSize: 11,
    fontWeight: '700',
    borderWidth: 1.5,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    overflow: 'hidden',
  },

  submitText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
  },
});

export default ComposerToolbar;
