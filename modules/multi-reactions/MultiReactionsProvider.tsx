// =============================================================================
// MULTI-REACTIONS PROVIDER - Context + shared modal instances
// =============================================================================
// Hoists the reaction picker and breakdown modal into a single provider.
// Slot components call openReactionPicker/openReactionBreakdown from context.
// =============================================================================

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ReactionPicker } from './components/ReactionPicker';
import { ReactionBreakdownModal } from './components/ReactionBreakdownModal';
import { ReactionIcon } from './components/ReactionIcon';
import { useReactionConfig } from './hooks/useReactionConfig';
import { ChatReactionOverridesProvider } from '@/contexts/ChatReactionOverridesContext';
import type { ReactionType } from '@/types/feed';

// -----------------------------------------------------------------------------
// Param Types
// -----------------------------------------------------------------------------

export interface ReactionPickerParams {
  anchor: { top: number; left: number };
  currentType: ReactionType | string | null;
  onSelect: (type: ReactionType) => void;
}

export interface BreakdownParams {
  objectType: 'feed' | 'comment';
  objectId: number;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

interface MultiReactionsContextValue {
  openReactionPicker: (params: ReactionPickerParams) => void;
  openReactionBreakdown: (params: BreakdownParams) => void;
}

const MultiReactionsContext = createContext<MultiReactionsContextValue | null>(null);

export function useMultiReactions(): MultiReactionsContextValue | null {
  return useContext(MultiReactionsContext);
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function MultiReactionsProvider({ children }: { children: React.ReactNode }) {
  const [pickerState, setPickerState] = useState<ReactionPickerParams | null>(null);
  const [breakdownState, setBreakdownState] = useState<BreakdownParams | null>(null);
  const { reactions, getReaction } = useReactionConfig();

  const openReactionPicker = useCallback((params: ReactionPickerParams) => setPickerState(params), []);
  const openReactionBreakdown = useCallback((params: BreakdownParams) => setBreakdownState(params), []);

  const value = useMemo<MultiReactionsContextValue>(() => ({
    openReactionPicker,
    openReactionBreakdown,
  }), [openReactionPicker, openReactionBreakdown]);

  // Chat reaction overrides — maps emoji text to custom icons
  const chatOverrides = useMemo(() => {
    if (reactions.length === 0) return null;
    return {
      defaultEmoji: reactions[0].emoji,
      renderIcon: (emoji: string, size: number) => {
        const config = getReaction(reactions.find(r => r.emoji === emoji)?.id || '');
        return <ReactionIcon iconUrl={config?.icon_url} emoji={emoji} size={size} />;
      },
    };
  }, [reactions, getReaction]);

  return (
    <MultiReactionsContext.Provider value={value}>
      {chatOverrides ? (
        <ChatReactionOverridesProvider value={chatOverrides}>
          {children}
        </ChatReactionOverridesProvider>
      ) : children}

      {/* Reaction Picker */}
      <ReactionPicker
        visible={!!pickerState}
        onSelect={(type) => { pickerState?.onSelect(type); setPickerState(null); }}
        onClose={() => setPickerState(null)}
        currentType={pickerState?.currentType as ReactionType | null}
        anchor={pickerState?.anchor}
      />

      {/* Reaction Breakdown */}
      <ReactionBreakdownModal
        visible={!!breakdownState}
        onClose={() => setBreakdownState(null)}
        objectType={breakdownState?.objectType || 'feed'}
        objectId={breakdownState?.objectId || 0}
      />
    </MultiReactionsContext.Provider>
  );
}
