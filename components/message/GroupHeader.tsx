// =============================================================================
// GROUP HEADER - Pressable header center for group chat detail screen
// =============================================================================
// Group avatar + title + "N members" subtitle. Tap opens GroupInfoSheet.
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

interface GroupHeaderProps {
  title: string;
  iconUrl?: string | null;
  memberCount?: number;
  loading?: boolean;
  onPress?: () => void;
}

export function GroupHeader({ title, iconUrl, memberCount, loading, onPress }: GroupHeaderProps) {
  const { colors } = useTheme();

  return (
    <Pressable style={styles.container} onPress={onPress} disabled={!onPress}>
      <Avatar source={iconUrl} size="sm" fallback={title} />
      <View style={styles.textColumn}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {typeof memberCount === 'number' && memberCount > 0 && (
          <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>
            {memberCount === 1 ? '1 member' : `${memberCount} members`}
          </Text>
        )}
      </View>
      {loading && (
        <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  textColumn: {
    flexShrink: 1,
    alignItems: 'center',
  },

  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },

  subtitle: {
    fontSize: typography.size.xs,
    marginTop: 1,
  },

  loader: {
    marginLeft: spacing.xs,
  },
});

export default GroupHeader;
