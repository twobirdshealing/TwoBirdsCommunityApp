// =============================================================================
// SPACE FEATURED SHEET — pinned posts in the gear menu
// =============================================================================
// Mirrors the web's "Featured Posts" right-sidebar widget. Lazy: fetches
// on first open via useSpaceActivities, which dedups with SpaceActivitySheet
// (same /activities call returns both pinned_posts and activities).
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { BottomSheet, BottomSheetFlatList } from '@/components/common/BottomSheet';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useSpaceActivities } from '@/hooks/useSpaceActivities';
import type { PinnedPost } from '@/types/activity';
import { formatRelativeTime } from '@/utils/formatDate';
import { stripHtmlTags } from '@/utils/htmlToText';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

interface SpaceFeaturedSheetProps {
  visible: boolean;
  onClose: () => void;
  spaceId: number;
}

export function SpaceFeaturedSheet({ visible, onClose, spaceId }: SpaceFeaturedSheetProps) {
  const { colors } = useTheme();
  const router = useRouter();

  // Only enable the fetch while the sheet is visible. The cache key is shared
  // with SpaceActivitySheet so the data hydrates instantly if the other sheet
  // was opened first this session.
  const { pinnedPosts, isLoading, error } = useSpaceActivities(spaceId, visible);

  const handlePress = (post: PinnedPost) => {
    onClose();
    router.push({ pathname: '/feed/[id]', params: { id: String(post.id) } });
  };

  const renderItem = ({ item }: { item: PinnedPost }) => (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 },
      ]}
      onPress={() => handlePress(item)}
    >
      <Avatar source={item.xprofile.avatar} size="sm" fallback={item.xprofile.display_name} />
      <View style={styles.rowText}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {stripHtmlTags(item.message) || 'Untitled post'}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.xprofile.display_name} · {formatRelativeTime(item.created_at)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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
            Couldn&rsquo;t load featured posts
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <Ionicons name="star-outline" size={40} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No featured posts yet
        </Text>
      </View>
    );
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Featured Posts" heightPercentage={70}>
      <BottomSheetFlatList
        data={pinnedPosts}
        keyExtractor={(item: PinnedPost) => String(item.id)}
        renderItem={renderItem}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={pinnedPosts.length === 0 ? styles.emptyContainer : styles.listContent}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: spacing.xl,
  },

  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  rowText: { flex: 1 },

  title: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },

  meta: {
    fontSize: typography.size.sm,
    marginTop: 2,
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

export default SpaceFeaturedSheet;
