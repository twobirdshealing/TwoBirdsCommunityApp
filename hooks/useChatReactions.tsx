// =============================================================================
// USE CHAT REACTIONS - Basic emoji reaction logic for chat messages
// =============================================================================
// Manages: optimistic updates, reaction helpers for chat messages.
// Uses Fluent's native emoji-based reactions (not multi-reactions module).
// =============================================================================

import React, { useCallback } from 'react';
import { Text } from 'react-native';
import { ChatMessage } from '@/types/message';
import { messagesApi } from '@/services/api/messages';
import { optimisticUpdate } from '@/utils/optimisticUpdate';
import { hapticLight } from '@/utils/haptics';
import { createLogger } from '@/utils/logger';

const log = createLogger('ChatReactions');

const DEFAULT_EMOJI = '👍';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseChatReactionsParams {
  currentUserId: number;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useChatReactions({ currentUserId, setMessages }: UseChatReactionsParams) {
  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getUserReactionType = useCallback((message: ChatMessage): string | null => {
    const reactions = message.meta?.reactions;
    if (!reactions || !currentUserId) return null;
    for (const [emoji, userIds] of Object.entries(reactions)) {
      if (userIds.includes(currentUserId)) {
        return emoji;
      }
    }
    return null;
  }, [currentUserId]);

  /** Render reaction icon for breakdown pills */
  const renderReactionIcon = useCallback((emoji: string): React.ReactNode => {
    return <Text style={{ fontSize: 12 }}>{emoji}</Text>;
  }, []);

  /** Render the user's current reaction (or default) for the reaction button */
  const renderUserReactionIcon = useCallback((message: ChatMessage): (() => React.ReactNode) => {
    return () => {
      const reactions = message.meta?.reactions;
      if (reactions && currentUserId) {
        for (const [emoji, userIds] of Object.entries(reactions)) {
          if (userIds.includes(currentUserId)) {
            return <Text style={{ fontSize: 15 }}>{emoji}</Text>;
          }
        }
      }
      return <Text style={{ fontSize: 15 }}>{DEFAULT_EMOJI}</Text>;
    };
  }, [currentUserId]);

  // ---------------------------------------------------------------------------
  // Optimistic Updater
  // ---------------------------------------------------------------------------

  const makeReactionUpdater = useCallback((messageId: number, emoji: string) => {
    return (prev: ChatMessage[]): ChatMessage[] => prev.map(m => {
      if (m.id !== messageId) return m;
      const currentReactions = { ...(m.meta?.reactions || {}) };
      const userIds = currentReactions[emoji] ? [...currentReactions[emoji]] : [];
      const userIndex = userIds.indexOf(currentUserId);

      if (userIndex >= 0) {
        // Already reacted — remove
        userIds.splice(userIndex, 1);
        if (userIds.length === 0) {
          delete currentReactions[emoji];
        } else {
          currentReactions[emoji] = userIds;
        }
      } else {
        // Remove user from any other emoji first (one reaction per user)
        for (const [existingEmoji, existingIds] of Object.entries(currentReactions)) {
          const idx = existingIds.indexOf(currentUserId);
          if (idx >= 0) {
            const updated = [...existingIds];
            updated.splice(idx, 1);
            if (updated.length === 0) {
              delete currentReactions[existingEmoji];
            } else {
              currentReactions[existingEmoji] = updated;
            }
          }
        }
        // Add new reaction
        currentReactions[emoji] = [...(currentReactions[emoji] || []), currentUserId];
      }

      return { ...m, meta: { ...m.meta, reactions: currentReactions } };
    });
  }, [currentUserId]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /** Tap the smiley button — toggle default reaction */
  const handleDefaultReact = useCallback(async (message: ChatMessage) => {
    hapticLight();
    const reactions = message.meta?.reactions;
    let emojiToToggle = DEFAULT_EMOJI;

    if (reactions && currentUserId) {
      for (const [emoji, userIds] of Object.entries(reactions)) {
        if (userIds.includes(currentUserId)) {
          emojiToToggle = emoji;
          break;
        }
      }
    }

    try {
      await optimisticUpdate(
        setMessages,
        makeReactionUpdater(message.id, emojiToToggle),
        () => messagesApi.toggleReaction(message.id, emojiToToggle),
      );
    } catch (err) {
      log.error(err, 'Default reaction error');
    }
  }, [currentUserId, setMessages, makeReactionUpdater]);

  /** User taps an existing reaction pill on a message */
  const handleReactionPillPress = useCallback(async (message: ChatMessage, emoji: string) => {
    try {
      await optimisticUpdate(
        setMessages,
        makeReactionUpdater(message.id, emoji),
        () => messagesApi.toggleReaction(message.id, emoji),
      );
    } catch (err) {
      log.error(err, 'Reaction toggle error');
    }
  }, [setMessages, makeReactionUpdater]);

  return {
    // Helpers
    getUserReactionType,
    renderReactionIcon,
    renderUserReactionIcon,
    // Handlers
    handleDefaultReact,
    handleReactionPillPress,
  };
}
