// =============================================================================
// GROUP INFO SHEET - Members + admin actions for a group thread
// =============================================================================
// Single sheet handles read view (members list) AND admin actions, gated by
// `isAdmin`. Footer:
//   - "Leave group"     — every member, always.
//   - "Edit group"      — admins only.
//   - "Add members"     — admins only.
//   - "Delete group"    — admins only.
// Each member row taps open an action menu (admins only) for promote/demote
// and remove. Listens to group Pusher events to keep the members list fresh.
// =============================================================================

import { BottomSheet, BottomSheetFlatList } from '@/components/common/BottomSheet';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import { MemberCard, MemberCardData } from '@/components/member/MemberCard';
import { AddMembersSheet } from '@/components/message/AddMembersSheet';
import { EditGroupSheet } from '@/components/message/EditGroupSheet';
import { withOpacity } from '@/constants/colors';
import { sizing, spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import {
  useGroupAdminChangedListener,
  useGroupMemberAddedListener,
  useGroupMemberRemovedListener,
} from '@/contexts/PusherContext';
import { groupsApi } from '@/services/api/groups';
import type { GroupMember } from '@/types/message';
import { createLogger } from '@/utils/logger';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const log = createLogger('GroupInfoSheet');

interface GroupInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  threadId: number;
  threadTitle: string;
  isAdmin: boolean;
  currentUserId: number;
  /** Fired after admin actions complete so the parent can refresh the inbox. */
  onMutated?: () => void;
  /** Fired when the user leaves OR the group is deleted (caller pops back). */
  onLeftOrDeleted?: () => void;
}

export function GroupInfoSheet({
  visible,
  onClose,
  threadId,
  threadTitle,
  isAdmin,
  currentUserId,
  onMutated,
  onLeftOrDeleted,
}: GroupInfoSheetProps) {
  const { colors } = useTheme();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<number | null>(null);

  // Member-row action menu
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [actionMenuTarget, setActionMenuTarget] = useState<GroupMember | null>(null);

  // Sub-sheets
  const [editVisible, setEditVisible] = useState(false);
  const [addMembersVisible, setAddMembersVisible] = useState(false);

  // Load members when sheet becomes visible. The listing endpoint is the
  // server-authoritative source for `is_group_admin` per row.
  const loadMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await groupsApi.getGroupMembers(threadId);
      if (result.success) {
        setMembers(result.data.members?.data || []);
      } else {
        setError(result.error.message || 'Failed to load members');
      }
    } catch (err) {
      log.error(err, 'Failed to load members');
      setError('Failed to load members');
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (visible) loadMembers();
  }, [visible, loadMembers]);

  // Coalesce rapid-fire member events into a single refetch — admin adding
  // 5 users at once would otherwise fire 5 server round-trips back-to-back.
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null;
      loadMembers();
    }, 200);
  }, [loadMembers]);

  useEffect(() => {
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, []);

  // Real-time member updates while the sheet is mounted. Each handler ignores
  // events for other threads and refreshes from server on changes that affect
  // the listing — server is the source of truth for is_group_admin.
  useGroupMemberAddedListener((data) => {
    if (!visible || String(data.thread_id) !== String(threadId)) return;
    scheduleRefetch();
  });

  useGroupMemberRemovedListener((data) => {
    if (!visible || String(data.thread_id) !== String(threadId)) return;
    setMembers(prev => prev.filter(m => Number(m.user_id) !== Number(data.user_id)));
  });

  useGroupAdminChangedListener((data) => {
    if (!visible || String(data.thread_id) !== String(threadId)) return;
    setMembers(prev =>
      prev.map(m =>
        Number(m.user_id) === Number(data.user_id)
          ? { ...m, is_group_admin: data.is_admin }
          : m
      )
    );
  });

  // ---------------------------------------------------------------------------
  // Admin actions
  // ---------------------------------------------------------------------------

  const handleToggleAdmin = useCallback(async (member: GroupMember) => {
    setBusyMemberId(Number(member.user_id));
    try {
      const next = !member.is_group_admin;
      const result = await groupsApi.setGroupAdmin(threadId, Number(member.user_id), next);
      if (result.success) {
        setMembers(prev =>
          prev.map(m =>
            Number(m.user_id) === Number(member.user_id) ? { ...m, is_group_admin: next } : m
          )
        );
        onMutated?.();
      } else {
        Alert.alert('Error', result.error.message || 'Failed to update admin status');
      }
    } finally {
      setBusyMemberId(null);
    }
  }, [threadId, onMutated]);

  const handleRemoveMember = useCallback((member: GroupMember) => {
    Alert.alert(
      'Remove member',
      `Remove ${member.display_name} from this group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusyMemberId(Number(member.user_id));
            try {
              const result = await groupsApi.removeGroupMember(threadId, Number(member.user_id));
              if (result.success) {
                setMembers(prev => prev.filter(m => Number(m.user_id) !== Number(member.user_id)));
                onMutated?.();
              } else {
                Alert.alert('Error', result.error.message || 'Failed to remove member');
              }
            } finally {
              setBusyMemberId(null);
            }
          },
        },
      ]
    );
  }, [threadId, onMutated]);

  const handleLeave = useCallback(() => {
    Alert.alert(
      'Leave group',
      `Are you sure you want to leave "${threadTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const result = await groupsApi.leaveGroup(threadId);
            if (result.success) {
              onLeftOrDeleted?.();
            } else {
              Alert.alert('Error', result.error.message || 'Failed to leave group');
            }
          },
        },
      ]
    );
  }, [threadId, threadTitle, onLeftOrDeleted]);

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete group',
      `Permanently delete "${threadTitle}"? This cannot be undone — every member will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await groupsApi.deleteGroup(threadId);
            if (result.success) {
              onLeftOrDeleted?.();
            } else {
              Alert.alert('Error', result.error.message || 'Failed to delete group');
            }
          },
        },
      ]
    );
  }, [threadId, threadTitle, onLeftOrDeleted]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const renderMember = useCallback(
    ({ item }: { item: GroupMember }) => {
      const isSelf = Number(item.user_id) === Number(currentUserId);
      const isBusy = busyMemberId === Number(item.user_id);
      const tapEnabled = isAdmin && !isSelf;

      // `role: 'admin'` lights up MemberCard's existing "Admin" pill;
      // `nameSuffix` flags the row for the current user without mutating
      // the underlying display_name.
      const memberData: MemberCardData = {
        id: Number(item.user_id),
        user_id: Number(item.user_id),
        role: item.is_group_admin ? 'admin' : 'member',
        xprofile: {
          user_id: Number(item.user_id),
          display_name: item.display_name,
          username: item.username,
          avatar: item.avatar,
          is_verified: item.is_verified,
        },
      };

      return (
        <View style={isBusy ? styles.busyRow : undefined}>
          <MemberCard
            member={memberData}
            compact
            showRole
            showBio={false}
            showLastActive={false}
            nameSuffix={isSelf ? '(You)' : undefined}
            onPress={
              tapEnabled
                ? () => {
                    setActionMenuTarget(item);
                    setActionMenuVisible(true);
                  }
                : undefined
            }
          />
        </View>
      );
    },
    [currentUserId, busyMemberId, isAdmin],
  );

  const renderFooter = () => (
    <View style={[styles.footer, { borderTopColor: colors.border }]}>
      {isAdmin && (
        <>
          <Pressable
            style={[styles.footerBtn, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setAddMembersVisible(true)}
          >
            <Ionicons name="person-add-outline" size={18} color={colors.text} />
            <Text style={[styles.footerBtnText, { color: colors.text }]}>Add members</Text>
          </Pressable>
          <Pressable
            style={[styles.footerBtn, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setEditVisible(true)}
          >
            <Ionicons name="create-outline" size={18} color={colors.text} />
            <Text style={[styles.footerBtnText, { color: colors.text }]}>Edit group</Text>
          </Pressable>
          <Pressable
            style={[styles.footerBtn, { backgroundColor: withOpacity(colors.error, 0.1) }]}
            onPress={handleDelete}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.footerBtnText, { color: colors.error }]}>Delete group</Text>
          </Pressable>
        </>
      )}
      <Pressable
        style={[styles.footerBtn, { backgroundColor: withOpacity(colors.error, 0.1) }]}
        onPress={handleLeave}
      >
        <Ionicons name="exit-outline" size={18} color={colors.error} />
        <Text style={[styles.footerBtnText, { color: colors.error }]}>Leave group</Text>
      </Pressable>
    </View>
  );

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        title={threadTitle}
        heightPercentage={80}
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.loadingBox}>
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        ) : (
          <BottomSheetFlatList
            data={members}
            keyExtractor={(item) => String(item.user_id)}
            renderItem={renderMember}
            ListFooterComponent={renderFooter}
            contentContainerStyle={styles.listContent}
          />
        )}
      </BottomSheet>

      {/* Member-row action menu (admins only) */}
      <DropdownMenu
        visible={actionMenuVisible}
        onClose={() => setActionMenuVisible(false)}
        items={[
          ...(actionMenuTarget
            ? [
                {
                  key: 'admin',
                  label: actionMenuTarget.is_group_admin ? 'Remove admin' : 'Make admin',
                  icon: actionMenuTarget.is_group_admin
                    ? ('shield-outline' as const)
                    : ('shield-checkmark-outline' as const),
                  onPress: () => {
                    setActionMenuVisible(false);
                    handleToggleAdmin(actionMenuTarget);
                  },
                },
                {
                  key: 'remove',
                  label: 'Remove from group',
                  icon: 'person-remove-outline' as const,
                  destructive: true,
                  onPress: () => {
                    setActionMenuVisible(false);
                    handleRemoveMember(actionMenuTarget);
                  },
                },
              ]
            : []),
        ] as DropdownMenuItem[]}
      />

      {/* Sub-sheets */}
      <EditGroupSheet
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        threadId={threadId}
        currentTitle={threadTitle}
        onSaved={() => {
          setEditVisible(false);
          onMutated?.();
        }}
      />

      <AddMembersSheet
        visible={addMembersVisible}
        onClose={() => setAddMembersVisible(false)}
        threadId={threadId}
        existingMemberIds={members.map(m => Number(m.user_id))}
        onAdded={() => {
          setAddMembersVisible(false);
          loadMembers();
          onMutated?.();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },

  errorText: {
    fontSize: typography.size.md,
    textAlign: 'center',
  },

  listContent: {
    paddingBottom: spacing.xl,
  },

  // Faded while a per-row admin action (promote / demote / remove) is in flight.
  busyRow: { opacity: 0.5 },

  footer: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
  },

  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
  },

  footerBtnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});

export default GroupInfoSheet;
