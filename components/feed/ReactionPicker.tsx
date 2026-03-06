// =============================================================================
// REACTION PICKER - Popover emoji picker for multi-reactions
// =============================================================================
// Shows on long-press of the reaction button. Appears as a compact horizontal
// pill near the press location using Modal + measureInWindow positioning.
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
import { useReactionConfig } from '@/hooks/useReactionConfig';
import { ReactionIcon } from './ReactionIcon';
import { ReactionType } from '@/types/feed';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { spacing, sizing, shadows } from '@/constants/layout';
import { hapticLight } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const EMOJI_SIZE = 42;
const EMOJI_BUTTON_SIZE = 54;
const EMOJI_GAP = 4;             // Gap between emoji buttons (matches web)
const PICKER_VERTICAL_PAD = spacing.sm;
const PICKER_HORIZONTAL_PAD = spacing.sm;
const PICKER_GAP = 8;            // Gap between popover and trigger button
const SCREEN_EDGE_PADDING = 12;  // Min distance from screen edge
const BUTTON_HEIGHT_APPROX = 44; // Approx trigger button height for flip fallback

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ReactionPickerProps {
  visible: boolean;
  onSelect: (type: ReactionType) => void;
  onClose: () => void;
  currentType?: ReactionType | null;
  anchor?: { top: number; left: number };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ReactionPicker({
  visible,
  onSelect,
  onClose,
  currentType,
  anchor,
}: ReactionPickerProps) {
  const { colors: themeColors } = useTheme();
  const { reactions } = useReactionConfig();

  // Calculate popover position
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  const pickerWidth = reactions.length * EMOJI_BUTTON_SIZE + (reactions.length - 1) * EMOJI_GAP + PICKER_HORIZONTAL_PAD * 2;
  const pickerHeight = EMOJI_BUTTON_SIZE + PICKER_VERTICAL_PAD * 2;

  let left: number;
  let top: number;

  if (anchor) {
    // Center horizontally on the button
    left = anchor.left - pickerWidth / 2;
    // Position above the button
    top = anchor.top - pickerHeight - PICKER_GAP;
  } else {
    // Fallback: center on screen
    left = (screenWidth - pickerWidth) / 2;
    top = screenHeight * 0.5;
  }

  // Clamp horizontal to screen edges
  left = Math.max(SCREEN_EDGE_PADDING, Math.min(left, screenWidth - pickerWidth - SCREEN_EDGE_PADDING));

  // If too close to top, flip below the button
  if (top < SCREEN_EDGE_PADDING && anchor) {
    top = anchor.top + BUTTON_HEIGHT_APPROX + PICKER_GAP;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
      >
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
            const isActive = currentType === r.id;
            return (
              <AnimatedPressable
                key={r.id}
                style={[
                  styles.emojiButton,
                  isActive && { backgroundColor: (r.color || '#1877F2') + '20' },
                ]}
                onPress={() => {
                  hapticLight();
                  onSelect(r.id as ReactionType);
                  onClose();
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
    borderRadius: sizing.borderRadius.xs,
  },
});

export default ReactionPicker;
