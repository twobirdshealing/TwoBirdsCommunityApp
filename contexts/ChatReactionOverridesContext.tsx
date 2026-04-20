// =============================================================================
// CHAT REACTION OVERRIDES CONTEXT
// =============================================================================
// Allows modules (e.g., multi-reactions) to override default emoji and icon
// rendering for chat message reactions. Core defines the interface; the module's
// provider supplies values via its registered provider wrapper.
// =============================================================================

import React, { createContext, useContext } from 'react';

export interface ChatReactionOverrides {
  /** The default emoji to use when user hasn't reacted (e.g., first custom reaction) */
  defaultEmoji: string;
  /** Custom icon renderer — maps emoji text + size to a React node */
  renderIcon: (emoji: string, size: number) => React.ReactNode;
}

const ChatReactionOverridesContext = createContext<ChatReactionOverrides | null>(null);

export function ChatReactionOverridesProvider({
  value,
  children,
}: {
  value: ChatReactionOverrides;
  children: React.ReactNode;
}) {
  return (
    <ChatReactionOverridesContext.Provider value={value}>
      {children}
    </ChatReactionOverridesContext.Provider>
  );
}

/** Returns module-provided chat reaction overrides, or null if no module is active */
export function useChatReactionOverrides(): ChatReactionOverrides | null {
  return useContext(ChatReactionOverridesContext);
}
