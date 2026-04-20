// =============================================================================
// USE CHAT REACTIONS - Basic emoji reaction logic for chat messages
// =============================================================================
// Manages: optimistic updates, reaction helpers for chat messages.
// Uses Fluent's native emoji-based reactions (not multi-reactions module).
// =============================================================================

import React, { useCallback, useRef, useState } from 'react';
import { Text } from 'react-native';
import { ChatMessage } from '@/types/message';
import { messagesApi } from '@/services/api/messages';
import { optimisticUpdate } from '@/utils/optimisticUpdate';
import { hapticLight } from '@/utils/haptics';
import { useChatReactionOverrides } from '@/contexts/ChatReactionOverridesContext';
import { createLogger } from '@/utils/logger';

const log = createLogger('ChatReactions');

/** The 6 native Fluent Messaging reaction emojis */
export const NATIVE_CHAT_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🎉'];

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
  // Module overrides (e.g., multi-reactions provides custom icons + default emoji)
  const overrides = useChatReactionOverrides();
  const resolvedDefault = overrides?.defaultEmoji || NATIVE_CHAT_EMOJIS[0];
  const iconRenderer = overrides?.renderIcon || null;
  // ---------------------------------------------------------------------------
  // Picker State
  // ---------------------------------------------------------------------------

  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [reactionPickerAnchor, setReactionPickerAnchor] = useState<{ top: number; left: number } | undefined>();
  const reactionTargetMessageRef = useRef<ChatMessage | null>(null);

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
    if (iconRenderer) return iconRenderer(emoji, 22);
    return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
  }, [iconRenderer]);

  /** Render the user's current reaction (or default) for the reaction button */
  const renderUserReactionIcon = useCallback((message: ChatMessage): (() => React.ReactNode) => {
    return () => {
      const reactions = message.meta?.reactions;
      if (reactions && currentUserId) {
        for (const [emoji, userIds] of Object.entries(reactions)) {
          if (userIds.includes(currentUserId)) {
            if (iconRenderer) return iconRenderer(emoji, 35);
            return <Text style={{ fontSize: 35 }}>{emoji}</Text>;
          }
        }
      }
      if (iconRenderer) return iconRenderer(resolvedDefault, 35);
      return <Text style={{ fontSize: 35 }}>{resolvedDefault}</Text>;
    };
  }, [currentUserId, iconRenderer, resolvedDefault]);

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
    let emojiToToggle = resolvedDefault;

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
  }, [currentUserId, setMessages, makeReactionUpdater, resolvedDefault]);

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

  /** Long-press smiley button — open reaction picker */
  const handleReactionLongPress = useCallback((message: ChatMessage, anchor: { top: number; left: number }) => {
    hapticLight();
    reactionTargetMessageRef.current = message;
    setReactionPickerAnchor(anchor);
    setReactionPickerVisible(true);
  }, []);

  /** User selects an emoji from the picker */
  const handleReactionSelect = useCallback(async (emoji: string) => {
    const message = reactionTargetMessageRef.current;
    setReactionPickerVisible(false);
    reactionTargetMessageRef.current = null;
    if (!message) return;

    try {
      await optimisticUpdate(
        setMessages,
        makeReactionUpdater(message.id, emoji),
        () => messagesApi.toggleReaction(message.id, emoji),
      );
    } catch (err) {
      log.error(err, 'Reaction select error');
    }
  }, [setMessages, makeReactionUpdater]);

  /** Dismiss picker without selecting */
  const handleReactionPickerClose = useCallback(() => {
    setReactionPickerVisible(false);
    reactionTargetMessageRef.current = null;
  }, []);

  return {
    // Helpers
    getUserReactionType,
    renderReactionIcon,
    renderUserReactionIcon,
    // Picker state
    reactionPickerVisible,
    reactionPickerAnchor,
    reactionTargetMessageRef,
    // Handlers
    handleDefaultReact,
    handleReactionPillPress,
    handleReactionLongPress,
    handleReactionSelect,
    handleReactionPickerClose,
  };
}
