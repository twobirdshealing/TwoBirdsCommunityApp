// =============================================================================
// CHAT SCREEN LAYOUT - Shared scaffold for user / group / space chat detail
// =============================================================================
// All three chat detail screens share the same shell: PageHeader, FlashList +
// Load Older + KeyboardAvoidingView, ChatInput (or a footer override), the
// Reply/Delete dropdown menu, MediaViewer, ChatReactionPicker, bottom safe
// area. This layout owns those; route files supply the bits that differ
// (header, footer override, info sheet, screen-specific dropdowns).
// =============================================================================

import { ChatInput } from '@/components/message/ChatInput';
import { ChatReactionPicker } from '@/components/message/ChatReactionPicker';
import { DateSeparator, MessageBubble } from '@/components/message/MessageBubble';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import { MediaViewer } from '@/components/media/MediaViewer';
import { PageHeader } from '@/components/navigation/PageHeader';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatReactions } from '@/hooks/useChatReactions';
import { useMessageMenu } from '@/hooks/useMessageMenu';
import { getSlotComponent } from '@/modules/_registry';
import { ChatMessage, getMessagePreview } from '@/types/message';
import { FlashList } from '@shopify/flash-list';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Module slot — resolved at module load. A module can replace the chat
// reaction picker globally; falls through to the core picker otherwise.
const CustomChatPicker = getSlotComponent<React.ComponentProps<typeof ChatReactionPicker>>('chatReactionPicker');

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

interface ChatScreenLayoutProps {
  chat: ReturnType<typeof useChatMessages>;
  reactions: ReturnType<typeof useChatReactions>;
  menu: ReturnType<typeof useMessageMenu>;
  /** Current authenticated user ID — used to flag own messages and filter the menu. */
  currentUserId: number;
  /** Same listRef passed into useChatMessages — the hook scrolls on send/receive, the FlashList renders into it. */
  listRef: React.RefObject<any>;

  /** When true, show sender avatar on every received message (groups/spaces). When false, only first-in-group (DM consecutive-grouping). */
  showAvatarOnEveryReceived?: boolean;

  /** Header center node (avatar + title + subtitle). */
  headerCenter: React.ReactNode;
  /** Header right button. Defaults to nothing. */
  headerRight?: React.ReactNode;
  /** Override the default back button entirely (supply your own left chrome). */
  headerLeft?: React.ReactNode;
  /** Override the default back-button onPress (e.g. confirm before leaving an unsaved draft). Ignored when `headerLeft` is set. */
  onBack?: () => void;

  /** Replaces the default ChatInput when set (e.g. blocked banner, left-chat banner). */
  footerOverride?: React.ReactNode;
  /** Placeholder for the default ChatInput. */
  inputPlaceholder?: string;

  /** Empty state when there are no messages AND not loading (DM "no thread yet" — group/space always have a thread). */
  emptyState?: React.ReactNode;

  /** Tap a sender's avatar inside a message bubble. */
  onAvatarPress?: (message: ChatMessage) => void;

  /** Screen-specific overlays — info sheets, chat-level menus, etc. Rendered after the shared dropdowns. */
  children?: React.ReactNode;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ChatScreenLayout({
  chat,
  reactions,
  menu,
  currentUserId,
  listRef,
  showAvatarOnEveryReceived = false,
  headerCenter,
  headerRight,
  headerLeft,
  onBack,
  footerOverride,
  inputPlaceholder = 'Type a message...',
  emptyState,
  onAvatarPress,
  children,
}: ChatScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const { colors: themeColors } = useTheme();
  const router = useRouter();

  // Default avatar tap → open the sender's profile. Screens can override
  // by passing `onAvatarPress`. Stable identity so renderMessage stays memoized.
  const handleAvatarPress = useCallback(
    (message: ChatMessage) => {
      if (onAvatarPress) {
        onAvatarPress(message);
        return;
      }
      const username = message.xprofile?.username;
      if (username) {
        router.push(`/profile/${username}` as any);
      }
    },
    [onAvatarPress, router],
  );

  // ---------------------------------------------------------------------------
  // Render Messages
  // ---------------------------------------------------------------------------

  const getMessageDate = (dateString: string) => new Date(dateString).toDateString();

  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn = Number(item.user_id) === currentUserId;
    const prevMessage = index > 0 ? chat.messages[index - 1] : null;
    const showDateSeparator = !prevMessage ||
      getMessageDate(item.created_at) !== getMessageDate(prevMessage.created_at);

    const isFirstInGroup = !prevMessage ||
      Number(prevMessage.user_id) !== Number(item.user_id) ||
      getMessageDate(item.created_at) !== getMessageDate(prevMessage.created_at);

    const nextMessage = index < chat.messages.length - 1 ? chat.messages[index + 1] : null;
    const isLastInGroup = !nextMessage ||
      Number(nextMessage.user_id) !== Number(item.user_id) ||
      getMessageDate(item.created_at) !== getMessageDate(nextMessage.created_at);

    // Multi-participant: avatar on every non-own message (so a group with N
    // speakers always shows who said what). DM: only first-in-group.
    const showAvatar = showAvatarOnEveryReceived ? !isOwn : (!isOwn && isFirstInGroup);

    return (
      <>
        {showDateSeparator && <DateSeparator date={item.created_at} />}
        <MessageBubble
          message={item}
          isOwn={isOwn}
          showAvatar={showAvatar}
          showTimestamp={isLastInGroup}
          onAvatarPress={() => handleAvatarPress(item)}
          onDelete={isOwn ? chat.handleDeleteMessage : undefined}
          onDefaultReact={reactions.handleDefaultReact}
          onReactionLongPress={reactions.handleReactionLongPress}
          onReactionPress={reactions.handleReactionPillPress}
          onMenuPress={menu.handleMenuPress}
          onImagePress={menu.handleImagePress}
          onReplyPress={menu.handleReplyQuotePress}
          currentUserId={currentUserId}
          userReactionRenderer={reactions.renderUserReactionIcon(item)}
          reactionRenderer={reactions.renderReactionIcon}
        />
      </>
    );
  }, [
    chat.messages,
    chat.handleDeleteMessage,
    currentUserId,
    showAvatarOnEveryReceived,
    handleAvatarPress,
    reactions,
    menu,
  ]);

  // ---------------------------------------------------------------------------
  // Body — loading / empty / list
  // ---------------------------------------------------------------------------

  const renderBody = () => {
    if (chat.loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      );
    }
    if (chat.messages.length === 0 && emptyState) {
      return emptyState;
    }
    return (
      <FlashList
        ref={listRef}
        data={chat.messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          chat.loadingOlder ? (
            <View style={styles.loadOlderContainer}>
              <ActivityIndicator size="small" color={themeColors.primary} />
            </View>
          ) : chat.hasMore ? (
            <Pressable style={styles.loadOlderContainer} onPress={chat.loadOlderMessages}>
              <Text style={[styles.loadOlderText, { color: themeColors.primary }]}>
                Load earlier messages
              </Text>
            </Pressable>
          ) : null
        }
        onLoad={() => {
          listRef.current?.scrollToEnd({ animated: false });
        }}
        maintainVisibleContentPosition={{ autoscrollToBottomThreshold: 100 }}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      />
    );
  };

  // ---------------------------------------------------------------------------
  // Footer — caller override or default ChatInput
  // ---------------------------------------------------------------------------

  const footer = footerOverride ?? (
    <ChatInput
      onSend={chat.handleSend}
      sending={chat.sending}
      disabled={chat.loading}
      placeholder={inputPlaceholder}
      replyTo={chat.replyTo}
      onCancelReply={() => chat.setReplyTo(null)}
    />
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        <PageHeader
          left={
            headerLeft ?? (
              <HeaderIconButton
                icon="chevron-back"
                onPress={onBack ?? (() => router.back())}
              />
            )
          }
          center={headerCenter}
          right={headerRight}
        />

        <KeyboardAvoidingView style={styles.chatArea} behavior="padding">
          {renderBody()}
          {footer}
        </KeyboardAvoidingView>

        {/* Bottom safe area outside KAV so keyboard calc is correct */}
        <View style={{ height: insets.bottom, backgroundColor: themeColors.surface }} />
      </View>

      {/* Message-level menu (Reply / Delete) — identical across all chat screens */}
      <DropdownMenu
        visible={menu.messageMenuVisible}
        onClose={menu.closeMessageMenu}
        anchor={menu.messageMenuAnchor}
        items={[
          {
            key: 'reply',
            label: 'Reply',
            icon: 'arrow-undo-outline',
            onPress: () => {
              menu.closeMessageMenu();
              if (menu.messageMenuTarget) {
                chat.setReplyTo({
                  messageId: menu.messageMenuTarget.id,
                  previewText: getMessagePreview(menu.messageMenuTarget.text, 80),
                });
              }
            },
          },
          ...(menu.messageMenuTarget && Number(menu.messageMenuTarget.user_id) === currentUserId
            ? [{
                key: 'delete',
                label: 'Delete',
                icon: 'trash-outline' as const,
                destructive: true,
                onPress: () => {
                  const target = menu.messageMenuTarget;
                  menu.closeMessageMenu();
                  if (target) {
                    chat.handleDeleteMessage(target);
                  }
                },
              }]
            : []),
        ] as DropdownMenuItem[]}
      />

      <MediaViewer
        visible={menu.mediaViewerVisible}
        images={menu.mediaViewerImages}
        initialIndex={menu.mediaViewerIndex}
        onClose={menu.closeMediaViewer}
      />

      {React.createElement(CustomChatPicker || ChatReactionPicker, {
        visible: reactions.reactionPickerVisible,
        onSelect: reactions.handleReactionSelect,
        onClose: reactions.handleReactionPickerClose,
        currentEmoji: reactions.reactionTargetMessageRef.current
          ? reactions.getUserReactionType(reactions.reactionTargetMessageRef.current)
          : null,
        anchor: reactions.reactionPickerAnchor,
      })}

      {/* Screen-specific overlays (info sheets, chat-level menus) */}
      {children}
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  chatArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingVertical: spacing.md },
  loadOlderContainer: { alignItems: 'center', paddingVertical: spacing.md },
  loadOlderText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium },
});

export default ChatScreenLayout;
