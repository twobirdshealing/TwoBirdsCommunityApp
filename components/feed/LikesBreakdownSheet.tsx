// =============================================================================
// LIKES BREAKDOWN SHEET - Shows who liked a feed post (core fallback)
// =============================================================================
// Used when the multi-reactions module is NOT installed. Tapping the likes
// count in FeedCard opens this sheet with the full list of users who liked.
// =============================================================================

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { Avatar } from '@/components/common/Avatar';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { BottomSheet, BottomSheetScrollView } from '@/components/common/BottomSheet';
import { getFeedReactions } from '@/services/api/feeds';
import { spacing } from '@/constants/layout';
import type { Reaction } from '@/types/feed';

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface LikesBreakdownSheetProps {
  visible: boolean;
  onClose: () => void;
  feedId: number;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function LikesBreakdownSheet({ visible, onClose, feedId }: LikesBreakdownSheetProps) {
  const { colors: themeColors } = useTheme();
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) {
      setReactions([]);
      setLoading(true);
      return;
    }
    if (!feedId) return;

    let cancelled = false;
    setLoading(true);
    getFeedReactions(feedId)
      .then((result) => {
        if (cancelled) return;
        setReactions(result.success ? (result.data.reactions || []) : []);
      })
      .catch(() => {
        if (!cancelled) setReactions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [visible, feedId]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Likes">
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={themeColors.primary} />
        </View>
      ) : reactions.length === 0 ? (
        <View style={styles.loadingContainer}>
          <Text style={{ color: themeColors.textSecondary }}>No likes yet</Text>
        </View>
      ) : (
        <BottomSheetScrollView style={styles.userList}>
          {reactions.map((item, index) => (
            <View
              key={`${item.user_id}-${index}`}
              style={[styles.userRow, { borderBottomColor: themeColors.borderLight }]}
            >
              <Avatar source={item.xprofile?.avatar} size="sm" />
              <UserDisplayName
                name={item.xprofile?.display_name || 'Unknown'}
                verified={item.xprofile?.is_verified === 1}
                badgeSlugs={item.xprofile?.meta?.badge_slug ? [item.xprofile.meta.badge_slug] : undefined}
                numberOfLines={1}
                style={styles.nameRow}
              />
            </View>
          ))}
        </BottomSheetScrollView>
      )}
    </BottomSheet>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  userList: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
});
