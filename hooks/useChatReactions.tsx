// =============================================================================
// USE CHAT REACTIONS - Reaction logic for the user chat screen
// =============================================================================
// Extracted from messages/user/[userId].tsx to reduce route file size.
// Manages: reaction picker state, optimistic updates, reaction helpers.
// =============================================================================

import React, { useCallback, useRef, useState } from 'react';
import { ChatMessage } from '@/types/message';
import { useReactionConfig } from '@/hooks/useReactionConfig';
import { ReactionIcon } from '@/components/feed/ReactionIcon';
import { messagesApi } from '@/services/api/messages';
import { hapticLight, hapticMedium } from '@/utils/haptics';

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
  const { reactions: reactionConfigs } = useReactionConfig();

  // Picker state
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [reactionPickerAnchor, setReactionPickerAnchor] = useState<{ top: number; left: number } | undefined>();
  const reactionTargetMessageRef = useRef<ChatMessage | null>(null);

  // Default reaction (first in config)
  const defaultReactionConfig = reactionConfigs[0] || null;
  const defaultReactionEmoji = defaultReactionConfig?.emoji || '👍';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const typeIdToEmoji = useCallback((typeId: string): string => {
    const config = reactionConfigs.find(r => r.id === typeId);
    return config?.emoji || typeId;
  }, [reactionConfigs]);

  const emojiToConfig = useCallback((emoji: string) => {
    return reactionConfigs.find(r => r.emoji === emoji) || null;
  }, [reactionConfigs]);

  const getUserReactionType = useCallback((message: ChatMessage): string | null => {
    const reactions = message.meta?.reactions;
    if (!reactions || !currentUserId) return null;
    for (const [emoji, userIds] of Object.entries(reactions)) {
      if (userIds.includes(currentUserId)) {
        const config = emojiToConfig(emoji);
        return config?.id || null;
      }
    }
    return null;
  }, [currentUserId, emojiToConfig]);

  /** Render reaction icon for breakdown pills */
  const renderReactionIcon = useCallback((emoji: string): React.ReactNode => {
    const config = emojiToConfig(emoji);
    return <ReactionIcon iconUrl={config?.icon_url} emoji={emoji} size={16} />;
  }, [emojiToConfig]);

  /** Render the user's current reaction (or default) for the reaction button */
  const renderUserReactionIcon = useCallback((message: ChatMessage): (() => React.ReactNode) => {
    return () => {
      const reactions = message.meta?.reactions;
      if (reactions && currentUserId) {
        for (const [emoji, userIds] of Object.entries(reactions)) {
          if (userIds.includes(currentUserId)) {
            const config = emojiToConfig(emoji);
            return <ReactionIcon iconUrl={config?.icon_url} emoji={emoji} size={20} />;
          }
        }
      }
      return (
        <ReactionIcon
          iconUrl={defaultReactionConfig?.icon_url}
          emoji={defaultReactionEmoji}
          size={20}
        />
      );
    };
  }, [currentUserId, emojiToConfig, defaultReactionConfig, defaultReactionEmoji]);

  // ---------------------------------------------------------------------------
  // Optimistic Update
  // ---------------------------------------------------------------------------

  const applyOptimisticReaction = useCallback((messageId: number, emoji: string) => {
    setMessages(prev => prev.map(m => {
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
    }));
  }, [currentUserId, setMessages]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /** User selects a reaction from the picker */
  const handleReactionSelect = useCallback(async (typeId: string) => {
    const msg = reactionTargetMessageRef.current;
    if (!msg) return;
    reactionTargetMessageRef.current = null;
    setReactionPickerVisible(false);

    const emoji = typeIdToEmoji(typeId);
    applyOptimisticReaction(msg.id, emoji);

    try {
      await messagesApi.toggleReaction(msg.id, emoji);
    } catch (err) {
      if (__DEV__) console.error('[useChatReactions] Reaction error:', err);
    }
  }, [typeIdToEmoji, applyOptimisticReaction]);

  /** User taps an existing reaction pill on a message */
  const handleReactionPillPress = useCallback(async (message: ChatMessage, emoji: string) => {
    applyOptimisticReaction(message.id, emoji);
    try {
      await messagesApi.toggleReaction(message.id, emoji);
    } catch (err) {
      if (__DEV__) console.error('[useChatReactions] Reaction toggle error:', err);
    }
  }, [applyOptimisticReaction]);

  /** Tap the smiley button — toggle default reaction */
  const handleDefaultReact = useCallback(async (message: ChatMessage) => {
    hapticLight();
    const reactions = message.meta?.reactions;
    let emojiToToggle = defaultReactionEmoji;

    if (reactions && currentUserId) {
      for (const [emoji, userIds] of Object.entries(reactions)) {
        if (userIds.includes(currentUserId)) {
          emojiToToggle = emoji;
          break;
        }
      }
    }

    applyOptimisticReaction(message.id, emojiToToggle);
    try {
      await messagesApi.toggleReaction(message.id, emojiToToggle);
    } catch (err) {
      if (__DEV__) console.error('[useChatReactions] Default reaction error:', err);
    }
  }, [currentUserId, defaultReactionEmoji, applyOptimisticReaction]);

  /** Long-press smiley — open picker */
  const handleReactionLongPress = useCallback((message: ChatMessage, anchor: { top: number; left: number }) => {
    hapticMedium();
    reactionTargetMessageRef.current = message;
    setReactionPickerAnchor(anchor);
    setReactionPickerVisible(true);
  }, []);

  /** Dismiss picker without selection */
  const handleReactionPickerClose = useCallback(() => {
    setReactionPickerVisible(false);
    reactionTargetMessageRef.current = null;
  }, []);

  return {
    // Picker state
    reactionPickerVisible,
    reactionPickerAnchor,
    reactionTargetMessageRef,
    // Helpers
    getUserReactionType,
    renderReactionIcon,
    renderUserReactionIcon,
    // Handlers
    handleReactionSelect,
    handleReactionPillPress,
    handleDefaultReact,
    handleReactionLongPress,
    handleReactionPickerClose,
  };
}
