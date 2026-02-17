// =============================================================================
// REACTION PICKER - Floating emoji picker for multi-reactions
// =============================================================================
// Shows on long-press of the reaction button. Anchored near the bottom of the
// screen for easy thumb access. Wraps into multiple rows if many reactions.
// =============================================================================

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useReactionConfig } from '@/hooks';
import { ReactionIcon } from './ReactionIcon';
import { ReactionType } from '@/types/feed';
import { shadows, spacing, typography } from '@/constants/layout';
import * as Haptics from 'expo-haptics';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ReactionPickerProps {
  visible: boolean;
  onSelect: (type: ReactionType) => void;
  onClose: () => void;
  currentType?: ReactionType | null;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ReactionPicker({
  visible,
  onSelect,
  onClose,
  currentType,
}: ReactionPickerProps) {
  const { colors: themeColors } = useTheme();
  const { reactions } = useReactionConfig();
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          tension: 200,
          friction: 15,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable style={[styles.overlay, { backgroundColor: themeColors.overlay }]} onPress={onClose}>
        <Animated.View
          style={[
            styles.picker,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.borderLight,
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
              marginBottom: insets.bottom + 16,
            },
          ]}
        >
          {reactions.map((r) => {
            const isActive = currentType === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                style={[
                  styles.emojiButton,
                  isActive && [styles.emojiButtonActive, { backgroundColor: (r.color || '#1877F2') + '20' }],
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelect(r.id as ReactionType);
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <ReactionIcon iconUrl={r.icon_url} emoji={r.emoji} size={35} />
                <Text
                  style={[
                    styles.emojiLabel,
                    { color: isActive ? (r.color || '#1877F2') : themeColors.textTertiary },
                  ]}
                >
                  {r.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    borderRadius: 28,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    maxWidth: 400,
    ...shadows.md,
  },
  emojiButton: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
  },
  emojiButtonActive: {
    borderRadius: 16,
  },
  emoji: {
    fontSize: 28,
  },
  emojiLabel: {
    fontSize: typography.size.xs,
    fontWeight: '500',
    marginTop: 2,
  },
});

export default ReactionPicker;
