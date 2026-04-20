// =============================================================================
// CHAT REACTION PICKER SLOT - Multi-reaction picker for chat messages
// =============================================================================
// Replaces the core ChatReactionPicker when the multi-reactions module is active.
// Shows custom icons from the plugin config instead of native emoji text.
// Maps between emoji text (chat API) and reaction config (module).
// =============================================================================

import React from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useReactionConfig } from '../hooks/useReactionConfig';
import { ReactionIcon } from './ReactionIcon';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { spacing, sizing, shadows } from '@/constants/layout';
import { hapticLight } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const EMOJI_SIZE = 42;
const EMOJI_BUTTON_SIZE = 54;
const EMOJI_GAP = 4;
const PICKER_VERTICAL_PAD = spacing.sm;
const PICKER_HORIZONTAL_PAD = spacing.sm;
const PICKER_GAP = 8;
const SCREEN_EDGE_PADDING = 12;
const BUTTON_HEIGHT_APPROX = 28;

// -----------------------------------------------------------------------------
// Props (same interface as core ChatReactionPicker)
// -----------------------------------------------------------------------------

interface ChatReactionPickerSlotProps {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  currentEmoji?: string | null;
  anchor?: { top: number; left: number };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ChatReactionPickerSlot({
  visible,
  onSelect,
  onClose,
  currentEmoji,
  anchor,
}: ChatReactionPickerSlotProps) {
  const { colors: themeColors } = useTheme();
  const { reactions } = useReactionConfig();

  if (!visible || reactions.length === 0) return null;

  // Calculate popover position
  const screenWidth = Dimensions.get('window').width;
  const pickerWidth = reactions.length * EMOJI_BUTTON_SIZE
    + (reactions.length - 1) * EMOJI_GAP
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
          {reactions.map((r) => {
            // Match by emoji text (chat stores emoji, not type ids)
            const isActive = currentEmoji === r.emoji;
            return (
              <AnimatedPressable
                key={r.id}
                style={[
                  styles.emojiButton,
                  isActive && { backgroundColor: (r.color || '#1877F2') + '20' },
                ]}
                onPress={() => {
                  hapticLight();
                  onSelect(r.emoji);
                }}
                haptic={false}
              >
                <ReactionIcon iconUrl={r.icon_url} emoji={r.emoji} size={EMOJI_SIZE} />
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
});
