// =============================================================================
// EDIT GROUP SHEET - Edit group title (and icon URL when surfaced later)
// =============================================================================
// Pre-fills from current title. On save, server emits `thread_updated` Pusher
// event so all members see the rename in real-time. Mobile doesn't ship an
// icon picker yet (the API accepts an icon URL, but we don't expose upload).
// =============================================================================

import { BottomSheet, BottomSheetScrollView, SheetInput } from '@/components/common/BottomSheet';
import { sizing, spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { groupsApi } from '@/services/api/groups';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface EditGroupSheetProps {
  visible: boolean;
  onClose: () => void;
  threadId: number;
  currentTitle: string;
  onSaved?: () => void;
}

export function EditGroupSheet({ visible, onClose, threadId, currentTitle, onSaved }: EditGroupSheetProps) {
  const { colors } = useTheme();
  const [title, setTitle] = useState(currentTitle);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setTitle(currentTitle);
  }, [visible, currentTitle]);

  const handleSave = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Group title cannot be empty.');
      return;
    }
    if (trimmed === currentTitle.trim()) {
      onClose();
      return;
    }
    setSaving(true);
    try {
      const result = await groupsApi.updateGroup(threadId, { title: trimmed });
      if (result.success) {
        onSaved?.();
      } else {
        Alert.alert('Error', result.error.message || 'Failed to update group');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Edit group"
      heightPercentage={50}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Group title</Text>
        <SheetInput>
          {(inputProps) => (
            <TextInput
              {...inputProps}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.backgroundSecondary, borderColor: colors.border },
              ]}
              placeholder="Group title"
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              autoCapitalize="sentences"
              maxLength={192}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          )}
        </SheetInput>

        <View style={styles.actions}>
          <Pressable
            style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Text style={[styles.saveBtnText, { color: colors.textInverse }]}>Save</Text>
            )}
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },

  input: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
  },

  actions: {
    marginTop: spacing.md,
  },

  saveBtn: {
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
    alignItems: 'center',
  },

  saveBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});

export default EditGroupSheet;
