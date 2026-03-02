// =============================================================================
// USE MESSAGE MENU - Menu & media viewer state for chat screen
// =============================================================================
// Extracted from messages/user/[userId].tsx to reduce route file size.
// Manages: message context menu, media viewer lightbox, reply quote scroll.
// =============================================================================

import React, { useCallback, useState } from 'react';
import { ChatMessage } from '@/types/message';
import { hapticLight } from '@/utils/haptics';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseMessageMenuParams {
  messages: ChatMessage[];
  listRef: React.RefObject<any>;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useMessageMenu({ messages, listRef }: UseMessageMenuParams) {
  // Message menu state (... button → Reply / Delete)
  const [messageMenuVisible, setMessageMenuVisible] = useState(false);
  const [messageMenuAnchor, setMessageMenuAnchor] = useState<{ top: number; right: number } | undefined>();
  const [messageMenuTarget, setMessageMenuTarget] = useState<ChatMessage | null>(null);

  // Media viewer state (tap image to open lightbox)
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [mediaViewerImages, setMediaViewerImages] = useState<{ url: string }[]>([]);
  const [mediaViewerIndex, setMediaViewerIndex] = useState(0);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleMenuPress = useCallback((message: ChatMessage, anchor: { top: number; right: number }) => {
    hapticLight();
    setMessageMenuTarget(message);
    setMessageMenuAnchor(anchor);
    setMessageMenuVisible(true);
  }, []);

  const handleImagePress = useCallback((images: { url: string }[], index: number) => {
    setMediaViewerImages(images);
    setMediaViewerIndex(index);
    setMediaViewerVisible(true);
  }, []);

  /** Scroll to the original message when a reply quote is tapped */
  const handleReplyQuotePress = useCallback((messageId: number) => {
    const index = messages.findIndex(m => m.id === messageId);
    if (index >= 0) {
      listRef.current?.scrollToIndex({ index, animated: true });
    }
  }, [messages, listRef]);

  const closeMessageMenu = useCallback(() => {
    setMessageMenuVisible(false);
    setMessageMenuTarget(null);
  }, []);

  const closeMediaViewer = useCallback(() => {
    setMediaViewerVisible(false);
  }, []);

  return {
    // Message menu
    messageMenuVisible,
    messageMenuAnchor,
    messageMenuTarget,
    handleMenuPress,
    closeMessageMenu,
    // Media viewer
    mediaViewerVisible,
    mediaViewerImages,
    mediaViewerIndex,
    handleImagePress,
    closeMediaViewer,
    // Reply quote
    handleReplyQuotePress,
  };
}
