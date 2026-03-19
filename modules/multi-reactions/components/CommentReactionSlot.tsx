// =============================================================================
// COMMENT REACTION SLOT - Multi-reaction UI injected into CommentItem
// =============================================================================
// Same multi-reaction experience as FeedReactionSlot but for comments.
// =============================================================================

import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { useReactionConfig } from '@/hooks/useReactionConfig';
import { useMultiReactions } from '../MultiReactionsProvider';
import { ReactionIcon } from '@/components/feed/ReactionIcon';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { spacing, sizing } from '@/constants/layout';
import type { ReactionSlotProps } from './slotProps';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function CommentReactionSlot({
  hasReacted,
  userReactionType,
  userReactionIconUrl,
  onReact,
}: ReactionSlotProps) {
  const { reactions, getReaction } = useReactionConfig();
  const multiReactions = useMultiReactions();
  const reactionButtonRef = useRef<View>(null);

  const defaultReactionId = reactions[0]?.id || 'like';
  const userReactionConfig = getReaction(userReactionType || defaultReactionId);
  const iconUrl = userReactionIconUrl || userReactionConfig?.icon_url || null;
  const emoji = userReactionConfig?.emoji || '\u{1F44D}';
  const reactionColor = userReactionConfig?.color;

  return (
    <AnimatedPressable
      ref={reactionButtonRef}
      style={[
        styles.reactionButton,
        hasReacted && { backgroundColor: reactionColor + '15' },
      ]}
      onPress={() => {
        hapticLight();
        onReact(userReactionType || defaultReactionId);
      }}
      onLongPress={() => {
        hapticMedium();
        (reactionButtonRef.current as any)?.measureInWindow?.((x: number, y: number, width: number) => {
          multiReactions?.openReactionPicker({
            anchor: { top: y, left: x + width / 2 },
            currentType: userReactionType,
            onSelect: (type) => onReact(type),
          });
        });
      }}
      delayLongPress={400}
    >
      <View style={{ opacity: hasReacted ? 1 : 0.4 }}>
        <ReactionIcon iconUrl={iconUrl} emoji={emoji} size={35} />
      </View>
    </AnimatedPressable>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  reactionButton: {
    padding: spacing.xs,
    borderRadius: sizing.borderRadius.md,
  },
});
