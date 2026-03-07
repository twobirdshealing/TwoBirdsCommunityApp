// =============================================================================
// SELECT MODAL - Shared option-picker modal
// =============================================================================
// Generic modal that presents a list of string options for selection.
// Used by register.tsx and profile/edit.tsx for select/radio/gender fields.
// =============================================================================

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { hapticSelection } from '@/utils/haptics';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SelectModalProps {
  visible: boolean;
  title: string;
  options: string[];
  selectedValue: string | undefined;
  onSelect: (value: string) => void;
  onClose: () => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function SelectModal({
  visible,
  title,
  options,
  selectedValue,
  onSelect,
  onClose,
}: SelectModalProps) {
  const { colors: themeColors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: themeColors.overlay }]}
        onPress={onClose}
      >
        <View style={[styles.content, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.title, { color: themeColors.text }]}>
            {title}
          </Text>
          <ScrollView style={styles.scroll}>
            {options.map((option) => (
              <AnimatedPressable
                key={option}
                style={[
                  styles.option,
                  { borderBottomColor: themeColors.border },
                  selectedValue === option && {
                    backgroundColor: `${themeColors.primary}15`,
                  },
                ]}
                onPress={() => {
                  hapticSelection();
                  onSelect(option);
                  onClose();
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: themeColors.text },
                    selectedValue === option && {
                      color: themeColors.primary,
                      fontWeight: typography.weight.semibold,
                    },
                  ]}
                >
                  {option}
                </Text>
                {selectedValue === option && (
                  <Ionicons name="checkmark" size={20} color={themeColors.primary} />
                )}
              </AnimatedPressable>
            ))}
          </ScrollView>
          <Pressable
            style={[styles.cancelButton, { borderTopColor: themeColors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelText, { color: themeColors.textSecondary }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },

  content: {
    borderRadius: sizing.borderRadius.lg,
    width: '100%',
    maxHeight: '60%',
    overflow: 'hidden',
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    padding: spacing.lg,
    textAlign: 'center',
  },

  scroll: {
    maxHeight: 300,
  },

  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  optionText: {
    fontSize: typography.size.md,
    flex: 1,
  },

  cancelButton: {
    padding: spacing.lg,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  cancelText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
});
