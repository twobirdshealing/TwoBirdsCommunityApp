// =============================================================================
// FEED BREAKDOWN SLOT - Reaction breakdown summary for FeedCard footer right
// =============================================================================

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useReactionConfig } from '@/hooks/useReactionConfig';
import { useMultiReactions } from '../MultiReactionsProvider';
import { ReactionIcon } from '@/components/feed/ReactionIcon';
import { formatCompactNumber } from '@/utils/formatNumber';
import { spacing, typography } from '@/constants/layout';
import type { ReactionSlotProps } from './slotProps';

export function FeedBreakdownSlot({
  objectId,
  reactionsCount,
  reactionBreakdown,
}: ReactionSlotProps) {
  const { colors: themeColors } = useTheme();
  const { display } = useReactionConfig();
  const multiReactions = useMultiReactions();

  if (reactionBreakdown.length === 0 || reactionsCount <= 0) return null;

  return (
    <Pressable
      style={styles.container}
      onPress={() => multiReactions?.openReactionBreakdown({ objectType: 'feed', objectId })}
    >
      <View style={styles.emojiStack}>
        {reactionBreakdown.slice(0, display.count).map((item, i) => (
          <View
            key={item.type}
            style={{ zIndex: 10 + i, marginLeft: i === 0 ? 0 : -display.overlap }}
          >
            <ReactionIcon
              iconUrl={item.icon_url}
              emoji={item.emoji || '\u{1F44D}'}
              size={22}
              stroke={display.stroke}
              borderColor={themeColors.borderLight}
            />
          </View>
        ))}
      </View>
      <Text style={[styles.countText, { color: themeColors.textSecondary }]}>
        {formatCompactNumber(reactionsCount)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  emojiStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countText: {
    fontSize: typography.size.sm,
  },
});
