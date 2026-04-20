// =============================================================================
// CHAT REACTION PICKER - Native emoji picker for chat message reactions
// =============================================================================
// Shows on long-press of the smiley button. Displays the 6 native Fluent
// Messaging emojis as a compact horizontal pill near the press location.
// When the multi-reactions module is active, it can override this via the
// chatReactionPicker slot.
// =============================================================================

import React from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { withOpacity } from '@/constants/colors';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { spacing, sizing, shadows } from '@/constants/layout';
import { hapticLight } from '@/utils/haptics';
import { NATIVE_CHAT_EMOJIS } from '@/hooks/useChatReactions';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const EMOJI_SIZE = 28;
const EMOJI_BUTTON_SIZE = 42;
const EMOJI_GAP = 4;
const PICKER_VERTICAL_PAD = spacing.sm;
const PICKER_HORIZONTAL_PAD = spacing.sm;
const PICKER_GAP = 8;
const SCREEN_EDGE_PADDING = 12;
const BUTTON_HEIGHT_APPROX = 28;

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ChatReactionPickerProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  currentEmoji?: string | null;
  anchor?: { top: number; left: number };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ChatReactionPicker({
  visible,
  onSelect,
  onClose,
  currentEmoji,
  anchor,
}: ChatReactionPickerProps) {
  const { colors: themeColors } = useTheme();

  if (!visible) return null;

  const screenWidth = Dimensions.get('window').width;
  const pickerWidth = NATIVE_CHAT_EMOJIS.length * EMOJI_BUTTON_SIZE
    + (NATIVE_CHAT_EMOJIS.length - 1) * EMOJI_GAP
    + PICKER_HORIZONTAL_PAD * 2;
  const pickerHeight = EMOJI_BUTTON_SIZE + PICKER_VERTICAL_PAD * 2;

  let left: number;
  let top: number;

  if (anchor) {
    left = anchor.left - pickerWidth / 2;
    top = anchor.top - pickerHeight - PICKER_GAP;
  } else {
    left = (screenWidth - pickerWidth) / 2;
    top = Dimensions.get('window').height * 0.5;
  }

  // Clamp horizontal to screen edges
  left = Math.max(SCREEN_EDGE_PADDING, Math.min(left, screenWidth - pickerWidth - SCREEN_EDGE_PADDING));

  // If too close to top, flip below the button
  if (top < SCREEN_EDGE_PADDING && anchor) {
    top = anchor.top + BUTTON_HEIGHT_APPROX + PICKER_GAP;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View
          style={[
            styles.pickerContainer,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.border,
              top,
              left,
            },
            shadows.lg,
          ]}
        >
          {NATIVE_CHAT_EMOJIS.map((emoji) => {
            const isActive = currentEmoji === emoji;
            return (
              <AnimatedPressable
                key={emoji}
                style={[
                  styles.emojiButton,
                  isActive && { backgroundColor: withOpacity(themeColors.primary, 0.15) },
                ]}
                onPress={() => {
                  hapticLight();
                  onSelect(emoji);
                }}
                haptic={false}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  pickerContainer: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PICKER_HORIZONTAL_PAD,
    paddingVertical: PICKER_VERTICAL_PAD,
    borderRadius: sizing.borderRadius.sm,
    borderWidth: 1,
    gap: EMOJI_GAP,
  },
  emojiButton: {
    width: EMOJI_BUTTON_SIZE,
    height: EMOJI_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizing.borderRadius.sm,
  },
  emojiText: {
    fontSize: EMOJI_SIZE,
  },
});
