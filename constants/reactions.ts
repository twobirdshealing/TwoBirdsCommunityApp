// =============================================================================
// REACTIONS - Multi-reaction emoji, color, and name mappings
// =============================================================================
// Matches the reaction types configured in the tb-multi-reactions WP plugin

import { ReactionType } from '@/types/feed';

// -----------------------------------------------------------------------------
// Emoji mapping (defaults only; custom reactions use config from API)
// -----------------------------------------------------------------------------

export const REACTION_EMOJI: Record<string, string> = {
  like: '👍',
  love: '❤️',
  laugh: '😂',
  wow: '😮',
  sad: '😢',
  angry: '😠',
};

// -----------------------------------------------------------------------------
// Color mapping
// -----------------------------------------------------------------------------

export const REACTION_COLORS: Record<string, string> = {
  like: '#1877F2',
  love: '#F02849',
  laugh: '#FEEB30',
  wow: '#FEEB30',
  sad: '#FEEB30',
  angry: '#E41E3F',
};

// -----------------------------------------------------------------------------
// Display name mapping
// -----------------------------------------------------------------------------

export const REACTION_NAMES: Record<string, string> = {
  like: 'Like',
  love: 'Love',
  laugh: 'Laugh',
  wow: 'Wow',
  sad: 'Sad',
  angry: 'Angry',
};

// -----------------------------------------------------------------------------
// Default reaction types in display order
// -----------------------------------------------------------------------------

export const REACTION_TYPES: ReactionType[] = [
  'like', 'love', 'laugh', 'wow', 'sad', 'angry',
];
