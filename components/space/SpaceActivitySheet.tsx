// =============================================================================
// SPACE ACTIVITY SHEET — recent feed_published / comment_added events
// =============================================================================
// Mirrors the web's "Recent Space Activities" right-sidebar widget. Lazy:
// shares the /activities call with SpaceFeaturedSheet (same TanStack key),
// so opening this after Featured costs zero extra round-trips.
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { BottomSheet, BottomSheetFlatList } from '@/components/common/BottomSheet';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useSpaceActivities } from '@/hooks/useSpaceActivities';
import type { SpaceActivity } from '@/types/activity';
import { formatRelativeTime } from '@/utils/formatDate';
import { stripHtmlTags } from '@/utils/htmlToText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

interface SpaceActivitySheetProps {
  visible: boolean;
  onClose: () => void;
  spaceId: number;
}

export function SpaceActivitySheet({ visible, onClose, spaceId }: SpaceActivitySheetProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const { activities, isLoading, error } = useSpaceActivities(spaceId, visible);

  const handlePress = (activity: SpaceActivity) => {
    const slug = activity.route?.params?.slug;
    if (!slug) return;
    onClose();
    const commentId = activity.route?.query?.comment_id;
    router.push({
      pathname: '/feed/[id]',
      params: commentId
        ? { id: slug, comment_id: String(commentId) }
        : { id: slug },
    });
  };

  const renderItem = ({ item }: { item: SpaceActivity }) => (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
      onPress={() => handlePress(item)}
    >
      <Avatar source={item.xprofile.avatar} size="sm" fallback={item.xprofile.display_name} />
      <View style={styles.rowText}>
        <Text style={[styles.message, { color: colors.text }]} numberOfLines={3}>
          {stripHtmlTags(item.message)}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {formatRelativeTime(item.updated_at)}
        </Text>
      </View>
    </Pressable>
  );

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: colors.error }]}>
            Couldn&rsquo;t load activity
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Ionicons name="time-outline" size={40} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No recent activity
        </Text>
      </View>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Recent Activity" heightPercentage={70}>
      <BottomSheetFlatList
        data={activities}
        keyExtractor={(item: SpaceActivity) => String(item.id)}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={activities.length === 0 ? styles.emptyContainer : styles.listContent}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingBottom: spacing.xl },

  emptyContainer: { flexGrow: 1, justifyContent: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  rowText: { flex: 1 },

  message: {
    fontSize: typography.size.md,
    lineHeight: typography.size.md * 1.4,
  },

  meta: {
    fontSize: typography.size.sm,
    marginTop: spacing.xs,
  },

  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.md,
  },

  emptyText: {
    fontSize: typography.size.md,
  },
});

export default SpaceActivitySheet;
