// =============================================================================
// REACTION HELPERS - Optimistic update utilities for reaction_breakdown
// =============================================================================
// Used by handleReact in activity, space, bookmarks, and feed detail screens
// to keep the breakdown summary in sync during optimistic updates.
// =============================================================================

import { ReactionBreakdown, ReactionType } from '@/types/feed';
import { ReactionConfig } from '../hooks/useReactionConfig';

// -----------------------------------------------------------------------------
// Update breakdown optimistically
// -----------------------------------------------------------------------------

/**
 * Returns a new reaction_breakdown array reflecting the user's action.
 *
 * @param breakdown  Current breakdown array from the feed object
 * @param newType    The reaction type the user tapped
 * @param action     'add' | 'remove' | 'swap'
 * @param oldType    Previous reaction type (only needed for 'swap')
 * @param getReaction  Lookup function from useReactionConfig hook
 */
export function updateBreakdownOptimistically(
  breakdown: ReactionBreakdown[],
  newType: ReactionType,
  action: 'add' | 'remove' | 'swap',
  oldType: ReactionType | null,
  getReaction: (type: string) => ReactionConfig | null,
): ReactionBreakdown[] {
  // Deep copy to avoid mutating the original
  let updated = breakdown.map(b => ({ ...b }));

  if (action === 'remove') {
    updated = decrementType(updated, newType);
  } else if (action === 'swap') {
    if (oldType) {
      updated = decrementType(updated, oldType);
    }
    updated = incrementType(updated, newType, getReaction);
  } else {
    // add
    updated = incrementType(updated, newType, getReaction);
  }

  return updated;
}

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

function decrementType(
  breakdown: ReactionBreakdown[],
  type: ReactionType,
): ReactionBreakdown[] {
  const idx = breakdown.findIndex(b => b.type === type);
  if (idx === -1) return breakdown;

  if (breakdown[idx].count <= 1) {
    // Remove entry entirely
    return breakdown.filter((_, i) => i !== idx);
  }

  breakdown[idx].count -= 1;
  return breakdown;
}

function incrementType(
  breakdown: ReactionBreakdown[],
  type: ReactionType,
  getReaction: (type: string) => ReactionConfig | null,
): ReactionBreakdown[] {
  const idx = breakdown.findIndex(b => b.type === type);

  if (idx !== -1) {
    breakdown[idx].count += 1;
    return breakdown;
  }

  // New type — build entry from config
  const config = getReaction(type);
  breakdown.push({
    type,
    emoji: config?.emoji || '',
    icon_url: config?.icon_url || null,
    name: config?.name || type,
    count: 1,
    color: config?.color || '#1877F2',
  });

  return breakdown;
}

