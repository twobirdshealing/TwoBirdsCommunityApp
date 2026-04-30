// =============================================================================
// SPACE INFO SHEET - Members + View Community + Leave / Rejoin
// =============================================================================
// Mirrors the right-sidebar on the web inbox for community-space threads:
//   - Space avatar + title at top (rendered by BottomSheet's title prop)
//   - Paginated MEMBERS list (Load more on scroll)
//   - "View Community" button (navigates to the space's main screen)
//   - "Leave chat"  — when user is an active member (default state)
//   - "Rejoin chat" — when thread is in `left_community_threads` (faded variant)
// =============================================================================

import { BottomSheet, BottomSheetFlatList } from '@/components/common/BottomSheet';
import { MemberCard, MemberCardData } from '@/components/member/MemberCard';
import { withOpacity } from '@/constants/colors';
import { sizing, spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { spaceThreadsApi } from '@/services/api/spaceThreads';
import type { GroupMember } from '@/types/message';
import { createLogger } from '@/utils/logger';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const log = createLogger('SpaceInfoSheet');

interface SpaceInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  threadId: number;
  threadTitle: string;
  /** Space slug (for the View Community button). When missing, the button is hidden. */
  spaceSlug?: string | null;
  /** True when the thread came from `left_community_threads` — show Rejoin instead of Leave. */
  isLeft?: boolean;
  /** Fired after leave/rejoin completes so the inbox can refresh. */
  onMembershipChanged?: (next: 'left' | 'rejoined') => void;
}

export function SpaceInfoSheet({
  visible,
  onClose,
  threadId,
  threadTitle,
  spaceSlug,
  isLeft = false,
  onMembershipChanged,
}: SpaceInfoSheetProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadPage = useCallback(async (nextPage: number) => {
    const setter = nextPage === 1 ? setLoading : setLoadingMore;
    setter(true);
    try {
      const result = await spaceThreadsApi.getSpaceThreadMembers(threadId, nextPage);
      if (result.success) {
        const data = result.data.members;
        setMembers(prev => (nextPage === 1 ? data.data : [...prev, ...data.data]));
        setPage(data.current_page);
        setLastPage(data.last_page);
      }
    } catch (err) {
      log.error(err, 'Failed to load space members');
    } finally {
      setter(false);
    }
  }, [threadId]);

  useEffect(() => {
    if (visible) loadPage(1);
  }, [visible, loadPage]);

  const handleViewCommunity = () => {
    if (!spaceSlug) return;
    onClose();
    router.push({ pathname: '/space/[slug]', params: { slug: spaceSlug } });
  };

  const handleLeave = () => {
    Alert.alert('Leave chat', `Stop receiving messages from "${threadTitle}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            const result = await spaceThreadsApi.leaveSpaceThread(threadId);
            if (result.success) {
              onMembershipChanged?.('left');
              onClose();
            } else {
              Alert.alert('Error', result.error.message || 'Failed to leave chat');
            }
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const handleRejoin = async () => {
    setBusy(true);
    try {
      const result = await spaceThreadsApi.joinSpaceThread(threadId);
      if (result.success) {
        onMembershipChanged?.('rejoined');
        onClose();
      } else {
        Alert.alert('Error', result.error.message || 'Failed to rejoin chat');
      }
    } finally {
      setBusy(false);
    }
  };

  const renderMember = ({ item }: { item: GroupMember }) => {
    const memberData: MemberCardData = {
      id: Number(item.user_id),
      user_id: Number(item.user_id),
      xprofile: {
        user_id: Number(item.user_id),
        display_name: item.display_name,
        username: item.username,
        avatar: item.avatar,
        is_verified: item.is_verified,
      },
    };
    return (
      <MemberCard
        member={memberData}
        compact
        showRole={false}
        showBio={false}
        showLastActive={false}
      />
    );
  };

  const renderFooter = () => {
    const hasMore = page < lastPage;
    return (
      <>
        {hasMore && (
          <Pressable
            style={styles.loadMore}
            onPress={() => !loadingMore && loadPage(page + 1)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load more members</Text>
            )}
          </Pressable>
        )}

        <View style={[styles.actions, { borderTopColor: colors.border }]}>
          {spaceSlug && (
            <Pressable
              style={[styles.btn, { backgroundColor: colors.backgroundSecondary }]}
              onPress={handleViewCommunity}
            >
              <Ionicons name="open-outline" size={18} color={colors.text} />
              <Text style={[styles.btnText, { color: colors.text }]}>View Community</Text>
            </Pressable>
          )}
          <Pressable
            style={[
              styles.btn,
              {
                backgroundColor: isLeft ? colors.primary : withOpacity(colors.error, 0.1),
                opacity: busy ? 0.6 : 1,
              },
            ]}
            onPress={isLeft ? handleRejoin : handleLeave}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color={isLeft ? colors.textInverse : colors.error} />
            ) : (
              <>
                <Ionicons
                  name={isLeft ? 'enter-outline' : 'exit-outline'}
                  size={18}
                  color={isLeft ? colors.textInverse : colors.error}
                />
                <Text
                  style={[
                    styles.btnText,
                    { color: isLeft ? colors.textInverse : colors.error },
                  ]}
                >
                  {isLeft ? 'Rejoin chat' : 'Leave chat'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={threadTitle} heightPercentage={80}>
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
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
  );
}

const styles = StyleSheet.create({
  loadingBox: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },

  listContent: {
    paddingBottom: spacing.xl,
  },

  loadMore: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },

  loadMoreText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  actions: {
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.md,
  },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: sizing.borderRadius.md,
  },

  btnText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});

export default SpaceInfoSheet;
