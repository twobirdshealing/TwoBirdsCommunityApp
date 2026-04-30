// =============================================================================
// NEW GROUP SHEET / FORM - Site moderator creates a group thread
// =============================================================================
// Exports:
//   - NewGroupForm:  inline body — title + multi-select picker + Create button.
//                    Used by NewMessageModal's "New Group" tab.
//   - NewGroupSheet: BottomSheet wrapper around NewGroupForm for standalone use.
//
// Server gates this to site moderators (Helper::isModerator). UI gates the
// entry point too — the NewMessageModal tab only renders when canCreateGroup
// is true.
// =============================================================================

import { BottomSheet, SheetInput } from '@/components/common/BottomSheet';
import { MultiSelectUserPicker, PickerUser } from '@/components/common/MultiSelectUserPicker';
import { sizing, spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { groupsApi } from '@/services/api/groups';
import { ChatThread } from '@/types/message';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// -----------------------------------------------------------------------------
// NewGroupForm — inline body
// -----------------------------------------------------------------------------

interface NewGroupFormProps {
  /** Called with the newly-created thread on success. */
  onCreated: (thread: ChatThread) => void;
  /** Optional cancel/close callback (rendered as a header X by the parent). */
  onCancel?: () => void;
  /** When inside a BottomSheet, route the title input through SheetInput so the sheet adjusts to the keyboard. */
  inSheet?: boolean;
}

export function NewGroupForm({ onCreated, inSheet }: NewGroupFormProps) {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [members, setMembers] = useState<PickerUser[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'Group title cannot be empty.');
      return;
    }
    if (members.length === 0) {
      Alert.alert('Members required', 'Pick at least one person to add.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await groupsApi.createGroup({
        title: trimmed,
        member_ids: members.map(m => m.user_id),
      });
      if (result.success && result.data.thread) {
        onCreated(result.data.thread);
      } else if (!result.success) {
        Alert.alert('Error', result.error.message || 'Failed to create group');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const renderTitleInput = (extraProps: object = {}) => (
    <TextInput
      {...extraProps}
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
      returnKeyType="next"
    />
  );

  return (
    <View style={styles.body}>
      <View style={styles.fieldRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Title</Text>
        {inSheet ? (
          <SheetInput>{(inputProps) => renderTitleInput(inputProps)}</SheetInput>
        ) : (
          renderTitleInput()
        )}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary, paddingHorizontal: spacing.md }]}>
        Members
      </Text>

      <View style={styles.pickerWrap}>
        <MultiSelectUserPicker
          selected={members}
          onChange={setMembers}
          placeholder="Search for people..."
        />
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          style={[
            styles.btn,
            { backgroundColor: colors.primary, opacity: submitting || members.length === 0 || !title.trim() ? 0.6 : 1 },
          ]}
          onPress={handleCreate}
          disabled={submitting || members.length === 0 || !title.trim()}
        >
          {submitting ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <Text style={[styles.btnText, { color: colors.textInverse }]}>
              Create group{members.length > 0 ? ` (${members.length})` : ''}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// -----------------------------------------------------------------------------
// NewGroupSheet — bottom-sheet wrapper
// -----------------------------------------------------------------------------

interface NewGroupSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreated: (thread: ChatThread) => void;
}

export function NewGroupSheet({ visible, onClose, onCreated }: NewGroupSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="New group" heightPercentage={85}>
      <NewGroupForm onCreated={onCreated} inSheet />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },

  fieldRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },

  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },

  input: {
    borderWidth: 1,
    borderRadius: sizing.borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.size.md,
  },

  pickerWrap: {
    flex: 1,
    marginTop: spacing.xs,
  },

  footer: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },

  btn: {
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
    alignItems: 'center',
  },

  btnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});

export default NewGroupSheet;
