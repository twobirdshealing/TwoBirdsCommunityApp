// =============================================================================
// NEW MEMBERS WIDGET - Recently joined or recently active community members
// =============================================================================
// Horizontal avatar strip with an in-widget toggle (New / Active).
// - "New"    sorts by xprofile.created_at (registration date)
// - "Active" sorts by xprofile.last_activity
// Choice persists per-device via MMKV.
// Returns null if no members or fetch fails (hides header too).
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';
import { membersApi } from '@/services/api/members';
import { useAppQuery, WIDGET_STALE_TIME } from '@/hooks/useAppQuery';
import { Avatar } from '@/components/common/Avatar';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { HomeWidget } from '@/components/home/HomeWidget';
import { formatSmartDate } from '@/utils/formatDate';
import { storage } from '@/services/storage';
import { createLogger } from '@/utils/logger';
import type { WidgetComponentProps } from '@/modules/_types';
import type { SpaceMember } from '@/types/space';

const log = createLogger('NewMembersWidget');

// -----------------------------------------------------------------------------
// Sort persistence (MMKV)
// -----------------------------------------------------------------------------

type SortBy = 'created_at' | 'last_activity';
const SORT_KEY = 'tbc_new_members_sort';

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'created_at', label: 'New' },
  { key: 'last_activity', label: 'Active' },
];

function readSort(): SortBy {
  const v = storage.getString(SORT_KEY);
  return v === 'last_activity' ? 'last_activity' : 'created_at';
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function NewMembersWidget({ refreshKey, title, icon, onSeeAll }: WidgetComponentProps) {
  const router = useRouter();
  const { colors: themeColors } = useTheme();
  const [sortBy, setSortBy] = useState<SortBy>(readSort);

  const { data, isLoading, error } = useAppQuery<SpaceMember[]>({
    cacheKey: `tbc_widget_new_members_${sortBy}`,
    fetcher: async () => {
      const response = await membersApi.getMembers({ per_page: 5, sort_by: sortBy });
      if (!response.success) return [];
      return response.data.members?.data ?? [];
    },
    refreshKey,
    refreshOnFocus: false,
    staleTime: WIDGET_STALE_TIME,
  });

  useEffect(() => {
    if (error) log.error(error, 'Failed to load members', { sortBy });
  }, [error, sortBy]);

  const members = data ?? [];

  // Hide widget entirely on hard failure (no cached members + error or empty)
  if (!isLoading && members.length === 0) return null;

  const handleSortChange = (next: SortBy) => {
    if (next === sortBy) return;
    storage.set(SORT_KEY, next);
    setSortBy(next);
  };

  return (
    <HomeWidget title={title} icon={icon} onSeeAll={onSeeAll}>
      {/* Sort toggle */}
      <View style={styles.toggleRow}>
        {SORT_OPTIONS.map(({ key, label }) => (
          <SortPill
            key={key}
            label={label}
            active={sortBy === key}
            onPress={() => handleSortChange(key)}
          />
        ))}
      </View>

      {/* Members strip */}
      {isLoading && members.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={themeColors.primary} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {members.map((m) => {
            // last_activity is conditionally returned by FC (gated by canViewUserProfile),
            // declared on Profile rather than XProfile — read defensively.
            const xp = m.xprofile as typeof m.xprofile & { last_activity?: string };
            const dateIso = sortBy === 'created_at' ? xp.created_at : xp.last_activity;
            const fallback = (m.xprofile.display_name || m.xprofile.username || '?').charAt(0).toUpperCase();

            return (
              <AnimatedPressable
                key={m.user_id ?? m.id}
                style={styles.tile}
                onPress={() =>
                  router.push({
                    pathname: '/profile/[username]',
                    params: { username: m.xprofile.username },
                  })
                }
              >
                <Avatar source={m.xprofile.avatar} size="lg" fallback={fallback} />
                <Text
                  style={[styles.name, { color: themeColors.text }]}
                  numberOfLines={1}
                >
                  {m.xprofile.display_name}
                </Text>
                {dateIso ? (
                  <Text
                    style={[styles.meta, { color: themeColors.textTertiary }]}
                    numberOfLines={1}
                  >
                    {formatSmartDate(dateIso)}
                  </Text>
                ) : null}
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      )}
    </HomeWidget>
  );
}

// -----------------------------------------------------------------------------
// Sort pill (inline, theme-aware)
// -----------------------------------------------------------------------------

interface SortPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function SortPill({ label, active, onPress }: SortPillProps) {
  const { colors: themeColors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: active ? themeColors.primary : 'transparent',
          borderColor: active ? themeColors.primary : themeColors.border,
        },
      ]}
    >
      <Text
        style={[
          styles.pillLabel,
          { color: active ? themeColors.textInverse : themeColors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const TILE_WIDTH = 72;

const styles = StyleSheet.create({
  toggleRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },

  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: sizing.borderRadius.full,
    borderWidth: 1,
  },

  pillLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },

  tile: {
    width: TILE_WIDTH,
    alignItems: 'center',
    gap: spacing.xs,
  },

  name: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.medium,
    textAlign: 'center',
    width: '100%',
  },

  meta: {
    fontSize: typography.size.xs,
    textAlign: 'center',
    width: '100%',
  },

  loading: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});

export default NewMembersWidget;
