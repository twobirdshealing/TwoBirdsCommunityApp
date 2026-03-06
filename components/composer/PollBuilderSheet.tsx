// =============================================================================
// POLL BUILDER SHEET - Bottom sheet for creating/editing poll options
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, sizing, typography } from '@/constants/layout';
import { BottomSheet, SheetInput } from '@/components/common/BottomSheet';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PollData {
  type: 'single_choice' | 'multi_choice';
  options: string[]; // labels only — slugs generated on submit
  end_date: string;
}

interface PollBuilderSheetProps {
  visible: boolean;
  onClose: () => void;
  onDone: (data: PollData) => void;
  initialData?: PollData | null;
}

const MAX_OPTIONS = 4;
const MIN_OPTIONS = 2;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function PollBuilderSheet({ visible, onClose, onDone, initialData }: PollBuilderSheetProps) {
  const { colors } = useTheme();
  const [options, setOptions] = useState<string[]>(initialData?.options || ['', '']);
  const [type, setType] = useState<'single_choice' | 'multi_choice'>(initialData?.type || 'single_choice');

  // Reset state when sheet opens with new data
  useEffect(() => {
    if (visible) {
      setOptions(initialData?.options || ['', '']);
      setType(initialData?.type || 'single_choice');
    }
  }, [visible]);

  const updateOption = (index: number, text: string) => {
    const updated = [...options];
    updated[index] = text;
    setOptions(updated);
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions([...options, '']);
  };

  const removeOption = (index: number) => {
    if (options.length <= MIN_OPTIONS) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleDone = () => {
    const filled = options.filter(o => o.trim());
    if (filled.length < 2) return; // button is disabled, but guard anyway
    onDone({ type, options, end_date: '' });
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const filledCount = options.filter(o => o.trim()).length;

  return (
    <BottomSheet visible={visible} onClose={handleCancel} title="Create Poll">
      <View style={styles.content}>
        {/* Option Inputs */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Poll Options</Text>
        {options.map((option, index) => (
          <View key={index} style={styles.optionRow}>
            <SheetInput>
              {(inputProps) => (
                <TextInput
                  {...inputProps}
                  style={[styles.optionInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.borderLight }]}
                  placeholder={`Option ${index + 1}`}
                  placeholderTextColor={colors.textTertiary}
                  value={option}
                  onChangeText={(text) => updateOption(index, text)}
                  maxLength={100}
                />
              )}
            </SheetInput>
            {options.length > MIN_OPTIONS && (
              <Pressable
                onPress={() => removeOption(index)}
                style={styles.removeOption}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        ))}

        {/* Add Option */}
        {options.length < MAX_OPTIONS && (
          <AnimatedPressable style={styles.addOption} onPress={addOption}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.addOptionText, { color: colors.primary }]}>Add More</Text>
          </AnimatedPressable>
        )}

        {/* Settings */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>Poll Settings</Text>
        <View style={[styles.settingRow, { borderColor: colors.borderLight }]}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Allow multiple answers</Text>
          <Switch
            value={type === 'multi_choice'}
            onValueChange={(val) => setType(val ? 'multi_choice' : 'single_choice')}
            trackColor={{ false: colors.borderLight, true: colors.primary }}
          />
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <AnimatedPressable
            style={[styles.cancelButton, { borderColor: colors.border }]}
            onPress={handleCancel}
          >
            <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.doneButton, { backgroundColor: colors.primary }, filledCount < 2 && { opacity: 0.5 }]}
            onPress={handleDone}
            disabled={filledCount < 2}
          >
            <Text style={[styles.doneText, { color: colors.textInverse }]}>Done</Text>
          </AnimatedPressable>
        </View>
      </View>
    </BottomSheet>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
  },

  sectionLabel: {
    fontSize: typography.size.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },

  optionInput: {
    flex: 1,
    height: 44,
    borderRadius: sizing.borderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.md,
  },

  removeOption: {
    marginLeft: spacing.sm,
    padding: spacing.xs,
  },

  addOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },

  addOptionText: {
    fontSize: typography.size.sm,
    fontWeight: '600',
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },

  settingLabel: {
    fontSize: typography.size.md,
  },

  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },

  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },

  cancelText: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },

  doneButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
    alignItems: 'center',
  },

  doneText: {
    fontSize: typography.size.md,
    fontWeight: '600',
  },
});

export default PollBuilderSheet;
