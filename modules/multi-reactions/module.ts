// =============================================================================
// MULTI-REACTIONS MODULE - Multi-reaction support (like, love, laugh, etc.)
// =============================================================================
// Adds multi-reaction support to feed posts and comments via slots.
// Requires the tbc-multi-reactions WordPress companion plugin.
//
// Disable by removing this module from modules/_registry.ts.
// =============================================================================

import type { ModuleManifest } from '../_types';
import { MultiReactionsProvider } from './MultiReactionsProvider';
import { FeedReactionSlot } from './components/FeedReactionSlot';
import { FeedBreakdownSlot } from './components/FeedBreakdownSlot';
import { CommentReactionSlot } from './components/CommentReactionSlot';
import { CommentBreakdownSlot } from './components/CommentBreakdownSlot';

export const multiReactionsModule: ModuleManifest = {
  id: 'multi-reactions',
  name: 'Multi-Reactions',
  version: '1.0.0',
  description: 'Multi-reaction support (like, love, laugh, etc.) for feeds and comments',
  author: 'Two Birds Code',
  authorUrl: 'https://twobirdscode.com',
  license: 'Proprietary',
  companionPlugin: 'tbc-multi-reactions',

  slots: [
    {
      id: 'multi-reactions-feed',
      slot: 'feedReactions',
      priority: 10,
      component: FeedReactionSlot,
    },
    {
      id: 'multi-reactions-feed-breakdown',
      slot: 'feedReactionBreakdown',
      priority: 10,
      component: FeedBreakdownSlot,
    },
    {
      id: 'multi-reactions-comment',
      slot: 'commentReactions',
      priority: 10,
      component: CommentReactionSlot,
    },
    {
      id: 'multi-reactions-comment-breakdown',
      slot: 'commentReactionBreakdown',
      priority: 10,
      component: CommentBreakdownSlot,
    },
  ],

  providers: [
    {
      id: 'multi-reactions-provider',
      order: 40,
      component: MultiReactionsProvider,
    },
  ],
};
