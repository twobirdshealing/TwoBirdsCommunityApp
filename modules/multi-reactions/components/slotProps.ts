// =============================================================================
// SLOT PROPS - Shared prop interface for reaction slot components
// =============================================================================

import type { ReactionBreakdown, ReactionType } from '@/types/feed';

/** Props passed to feed/comment reaction slot components by core */
export interface ReactionSlotProps {
  objectType: 'feed' | 'comment';
  objectId: number;
  /** Whether the current user has reacted */
  hasReacted: boolean;
  /** Current user's reaction type (null if not reacted) */
  userReactionType: string | null;
  /** Current user's reaction icon URL (null if default) */
  userReactionIconUrl: string | null;
  /** Total reaction count */
  reactionsCount: number;
  /** Reaction breakdown array from server */
  reactionBreakdown: ReactionBreakdown[];
  /** Core react/unreact callback — call with reaction type */
  onReact: (type: ReactionType) => void;
}
