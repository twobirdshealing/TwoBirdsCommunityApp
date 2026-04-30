// =============================================================================
// ADD MEMBERS SHEET - Multi-select user picker for adding to an existing group
// =============================================================================
// Wraps MultiSelectUserPicker, filters out the existing member list, and posts
// the selected user IDs to /chat/groups/{threadId}/members.
// =============================================================================

import { BottomSheet } from '@/components/common/BottomSheet';
import { MultiSelectUserPicker, PickerUser } from '@/components/common/MultiSelectUserPicker';
import { sizing, spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { groupsApi } from '@/services/api/groups';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

interface AddMembersSheetProps {
  visible: boolean;
  onClose: () => void;
  threadId: number;
  existingMemberIds: number[];
  onAdded?: () => void;
}

export function AddMembersSheet({ visible, onClose, threadId, existingMemberIds, onAdded }: AddMembersSheetProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState<PickerUser[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setSelected([]);
  }, [visible]);

  const handleAdd = async () => {
    if (selected.length === 0) {
      Alert.alert('Select members', 'Pick at least one person to add.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await groupsApi.addGroupMembers(threadId, selected.map(s => s.user_id));
      if (result.success) {
        onAdded?.();
      } else {
        Alert.alert('Error', result.error.message || 'Failed to add members');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Add members"
      heightPercentage={80}
    >
      <View style={styles.body}>
        <MultiSelectUserPicker
          selected={selected}
          onChange={setSelected}
          excludeUserIds={existingMemberIds}
          placeholder="Search for people to add..."
        />

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <Pressable
            style={[styles.btn, { backgroundColor: colors.primary, opacity: submitting || selected.length === 0 ? 0.6 : 1 }]}
            onPress={handleAdd}
            disabled={submitting || selected.length === 0}
          >
            {submitting ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <Text style={[styles.btnText, { color: colors.textInverse }]}>
                Add {selected.length > 0 ? `(${selected.length})` : ''}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1 },

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

export default AddMembersSheet;
