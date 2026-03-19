// =============================================================================
// FEED REACTION SLOT - Multi-reaction UI injected into FeedCard footer
// =============================================================================
// Replaces the default like button with multi-reaction support:
// - Tap: toggle default reaction (or current type)
// - Long-press: open reaction picker
// - Breakdown summary: tappable to show who-reacted-with-what
// =============================================================================

import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useReactionConfig } from '@/hooks/useReactionConfig';
import { useMultiReactions } from '../MultiReactionsProvider';
import { ReactionIcon } from '@/components/feed/ReactionIcon';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { spacing, sizing } from '@/constants/layout';
import type { ReactionSlotProps } from './slotProps';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function FeedReactionSlot({
  objectId,
  hasReacted,
  userReactionType,
  userReactionIconUrl,
  reactionsCount,
  reactionBreakdown,
  onReact,
}: ReactionSlotProps) {
  const { colors: themeColors } = useTheme();
  const { reactions, getReaction, display } = useReactionConfig();
  const multiReactions = useMultiReactions();
  const reactionButtonRef = useRef<View>(null);

  const defaultReactionId = reactions[0]?.id || 'like';
  const userReactionConfig = getReaction(userReactionType || defaultReactionId);
  const iconUrl = userReactionIconUrl || userReactionConfig?.icon_url || null;
  const emoji = userReactionConfig?.emoji || '\u{1F44D}';
  const reactionColor = userReactionConfig?.color;

  return (
    <>
      {/* Reaction Button - tap for default like, long-press for picker */}
      <AnimatedPressable
        ref={reactionButtonRef}
        style={[
          styles.footerButton,
          hasReacted && { backgroundColor: (reactionColor || themeColors.primary) + '15' },
        ]}
        onPress={() => {
          hapticLight();
          if (hasReacted && userReactionType) {
            onReact(userReactionType);
          } else {
            onReact(defaultReactionId);
          }
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
        accessibilityRole="button"
        accessibilityLabel={hasReacted ? 'Remove reaction' : 'React to post'}
        accessibilityHint="Long press for more reactions"
      >
        <View style={{ opacity: hasReacted ? 1 : 0.4 }}>
          <ReactionIcon iconUrl={iconUrl} emoji={emoji} size={35} />
        </View>
      </AnimatedPressable>

    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  footerButton: {
    padding: spacing.xs,
    borderRadius: sizing.borderRadius.md,
  },
});
