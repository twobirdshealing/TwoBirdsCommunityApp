// =============================================================================
// FEED REACTION SLOT - Multi-reaction UI injected into FeedCard footer
// =============================================================================
// Replaces the default like button with multi-reaction support:
// - Tap: toggle default reaction (or current type)
// - Long-press: open reaction picker
// Module owns its own API calls via onFeedUpdate + module API.
// =============================================================================

import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { createLogger } from '@/utils/logger';
import { useReactionConfig } from '../hooks/useReactionConfig';
import { useMultiReactions } from '../MultiReactionsProvider';
import { ReactionIcon } from './ReactionIcon';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';
import { spacing, sizing } from '@/constants/layout';
import { reactToFeedWithType, swapReactionType, reconcileViaItemUpdate } from '../api';
import { updateBreakdownOptimistically } from '../utils/reactionHelpers';
import type { ReactionSlotProps } from './slotProps';
import type { Feed, ReactionType } from '@/types/feed';

const log = createLogger('FeedReactionSlot');

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function FeedReactionSlot({
  objectId,
  hasReacted,
  userReactionType,
  userReactionIconUrl,
  onReact,
  onFeedUpdate,
}: ReactionSlotProps) {
  const { colors: themeColors } = useTheme();
  const { reactions, getReaction } = useReactionConfig();
  const multiReactions = useMultiReactions();
  const reactionButtonRef = useRef<View>(null);

  const defaultReactionId = reactions[0]?.id || 'like';
  const userReactionConfig = getReaction(userReactionType || defaultReactionId);
  const iconUrl = userReactionIconUrl || userReactionConfig?.icon_url || null;
  const emoji = userReactionConfig?.emoji || '\u{1F44D}';
  const reactionColor = userReactionConfig?.color;

  const handleReact = async (type: ReactionType) => {
    if (!onFeedUpdate) {
      onReact(type);
      return;
    }

    const isSameType = hasReacted && userReactionType === type;
    const willRemove = isSameType;
    const willSwap = hasReacted && !isSameType;

    // Snapshot current state for rollback
    let snapshot: Feed | null = null;
    onFeedUpdate((feed: Feed) => {
      snapshot = { ...feed };

      const currentCount = typeof feed.reactions_count === 'string'
        ? parseInt(feed.reactions_count, 10)
        : feed.reactions_count || 0;
      const action = willRemove ? 'remove' : willSwap ? 'swap' : 'add';
      const updatedBreakdown = updateBreakdownOptimistically(
        feed.reaction_breakdown || [], type, action,
        (feed.user_reaction_type || null) as ReactionType | null, getReaction,
      );

      if (willRemove) {
        return { ...feed, has_user_react: false, user_reaction_type: null, user_reaction_icon_url: null, user_reaction_name: null, reactions_count: currentCount - 1, reaction_total: currentCount - 1, reaction_breakdown: updatedBreakdown };
      } else if (willSwap) {
        return { ...feed, user_reaction_type: type, user_reaction_icon_url: null, user_reaction_name: null, reaction_breakdown: updatedBreakdown };
      } else {
        return { ...feed, has_user_react: true, user_reaction_type: type, user_reaction_icon_url: null, user_reaction_name: null, reactions_count: currentCount + 1, reaction_total: currentCount + 1, reaction_breakdown: updatedBreakdown };
      }
    });

    try {
      if (willSwap) {
        await swapReactionType(objectId, 'feed', type);
      } else {
        await reactToFeedWithType(objectId, type, hasReacted);
      }
      // Sync optimistic state with server-accurate breakdown
      reconcileViaItemUpdate('feed', objectId, onFeedUpdate);
    } catch (err) {
      log.error(err, 'Reaction failed, reverting');
      if (snapshot) {
        onFeedUpdate(() => snapshot!);
      }
    }
  };

  return (
      <AnimatedPressable
        ref={reactionButtonRef}
        style={[
          styles.footerButton,
          hasReacted && { backgroundColor: (reactionColor || themeColors.primary) + '15' },
        ]}
        onPress={() => {
          hapticLight();
          if (hasReacted && userReactionType) {
            handleReact(userReactionType);
          } else {
            handleReact(defaultReactionId);
          }
        }}
        onLongPress={() => {
          hapticMedium();
          (reactionButtonRef.current as any)?.measureInWindow?.((x: number, y: number, width: number) => {
            multiReactions?.openReactionPicker({
              anchor: { top: y, left: x + width / 2 },
              currentType: userReactionType,
              onSelect: (type) => handleReact(type),
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
