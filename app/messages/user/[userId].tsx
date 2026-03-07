// =============================================================================
// USER CHAT SCREEN - Chat addressed by user ID
// =============================================================================
// Route: /messages/user/[userId]
// Features:
// - Resolves existing thread with this user, or shows empty compose
// - First message creates thread via startChatWithUser()
// - Full chat: message bubbles, send, poll, Pusher real-time
// - Navigate to participant profile
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import { ChatInput } from '@/components/message/ChatInput';
import { DateSeparator, MessageBubble } from '@/components/message/MessageBubble';
import { MediaViewer } from '@/components/media/MediaViewer';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { ReactionPicker } from '@/components/feed/ReactionPicker';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatReactions } from '@/hooks/useChatReactions';
import { useMessageMenu } from '@/hooks/useMessageMenu';
import { isUserOnline, formatLastActivity } from '@/utils/formatDate';
import { ChatMessage, getMessagePreview } from '@/types/message';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function UserChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, threadId: threadIdParam, displayName, avatar } = useLocalSearchParams<{
    userId: string;
    threadId?: string;
    displayName?: string;
    avatar?: string;
  }>();
  const { user } = useAuth();
  const { colors: themeColors } = useTheme();
  const targetUserId = parseInt(userId || '0', 10);
  const knownThreadId = threadIdParam ? parseInt(threadIdParam, 10) : null;
  const currentUserId = user?.id || 0;

  // Refs
  const listRef = useRef<any>(null);

  // ---------------------------------------------------------------------------
  // Hooks
  // ---------------------------------------------------------------------------

  const chat = useChatMessages({
    targetUserId,
    knownThreadId,
    currentUserId,
    listRef,
  });

  const reactions = useChatReactions({
    currentUserId,
    setMessages: chat.setMessages,
  });

  const menu = useMessageMenu({
    messages: chat.messages,
    listRef,
  });

  // Chat menu (settings gear) state
  const [chatMenuVisible, setChatMenuVisible] = React.useState(false);

  // ---------------------------------------------------------------------------
  // Header display: prefer threadDetails > intendedUser > route params
  // ---------------------------------------------------------------------------

  const headerName = chat.threadDetails?.info?.title
    || chat.intendedUser?.title
    || displayName
    || 'Chat';
  const headerAvatar = chat.threadDetails?.info?.photo
    || chat.intendedUser?.photo
    || avatar
    || null;
  const headerUsername = chat.threadDetails?.info?.username;
  const headerOnline = isUserOnline(chat.threadDetails?.info?.last_activity);
  const headerActivity = formatLastActivity(chat.threadDetails?.info?.last_activity);

  // ---------------------------------------------------------------------------
  // Navigation Handlers
  // ---------------------------------------------------------------------------

  const handleAvatarPress = (message: ChatMessage) => {
    const username = message.xprofile?.username;
    if (username) {
      router.push(`/profile/${username}` as any);
    }
  };

  const handleHeaderPress = () => {
    if (headerUsername) {
      router.push(`/profile/${headerUsername}` as any);
    }
  };

  // ---------------------------------------------------------------------------
  // Render Header
  // ---------------------------------------------------------------------------

  const renderHeaderCenter = () => (
    <Pressable style={styles.headerCenter} onPress={handleHeaderPress}>
      <Avatar
        source={headerAvatar}
        size="sm"
        fallback={headerName}
        online={headerOnline}
      />
      <View style={styles.headerTextColumn}>
        <Text style={[styles.headerTitle, { color: themeColors.text }]} numberOfLines={1}>
          {headerName}
        </Text>
        {headerActivity ? (
          <Text
            style={[
              styles.headerSubtitle,
              { color: headerOnline ? themeColors.success : themeColors.textTertiary },
            ]}
            numberOfLines={1}
          >
            {headerActivity}
          </Text>
        ) : null}
      </View>
      {chat.loading && (
        <ActivityIndicator size="small" color={themeColors.primary} style={styles.headerLoader} />
      )}
    </Pressable>
  );

  // ---------------------------------------------------------------------------
  // Render Messages
  // ---------------------------------------------------------------------------

  const getMessageDate = (dateString: string) => {
    return new Date(dateString).toDateString();
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
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

    return (
      <>
        {showDateSeparator && <DateSeparator date={item.created_at} />}
        <MessageBubble
          message={item}
          isOwn={isOwn}
          showAvatar={!isOwn && isFirstInGroup}
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
  };

  // ---------------------------------------------------------------------------
  // Render Empty State (no thread yet)
  // ---------------------------------------------------------------------------

  const renderEmptyCompose = () => (
    <View style={styles.emptyContainer}>
      <Avatar
        source={headerAvatar}
        size="lg"
        fallback={headerName}
      />
      <Text style={[styles.emptyName, { color: themeColors.text }]}>
        {headerName}
      </Text>
      <Text style={[styles.emptyHint, { color: themeColors.textSecondary }]}>
        Start a chat session with {headerName} by sending the first message.
      </Text>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  const chatAreaContent = (
    <>
      {chat.loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.primary} />
        </View>
      ) : chat.messages.length === 0 ? (
        renderEmptyCompose()
      ) : (
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
      )}

      {/* Blocked State or Input */}
      {chat.isBlocked ? (
        <View style={[styles.blockedContainer, { borderTopColor: themeColors.border }]}>
          <Text style={[styles.blockedTitle, { color: themeColors.text }]}>
            You blocked messages from {headerName}
          </Text>
          <Text style={[styles.blockedDescription, { color: themeColors.textSecondary }]}>
            You can't send or receive messages in this chat unless you unblock the user.
          </Text>
          <Pressable
            style={[styles.unblockButton, { borderColor: themeColors.border }]}
            onPress={chat.handleUnblockPress}
            disabled={chat.blockLoading}
          >
            {chat.blockLoading ? (
              <ActivityIndicator size="small" color={themeColors.text} />
            ) : (
              <Text style={[styles.unblockButtonText, { color: themeColors.text }]}>
                Unblock User
              </Text>
            )}
          </Pressable>
        </View>
      ) : (
        <ChatInput
          onSend={chat.handleSend}
          sending={chat.sending}
          disabled={chat.loading}
          placeholder={chat.thread ? 'Type a message...' : `Message ${headerName}...`}
          replyTo={chat.replyTo}
          onCancelReply={() => chat.setReplyTo(null)}
        />
      )}
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}>
          <Pressable
            style={styles.headerBackButton}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={24} color={themeColors.text} />
          </Pressable>

          {renderHeaderCenter()}

          <Pressable
            style={({ pressed }) => [styles.headerGearButton, pressed && { opacity: 0.7 }]}
            onPress={() => setChatMenuVisible(true)}
          >
            <Ionicons name="settings-outline" size={20} color={themeColors.text} />
          </Pressable>
        </View>

        {/* Chat Area */}
        <KeyboardAvoidingView
          style={styles.chatArea}
          behavior="padding"
        >
          {chatAreaContent}
        </KeyboardAvoidingView>

        {/* Bottom safe area - outside KAV so keyboard calc is correct */}
        <View style={{ height: insets.bottom, backgroundColor: themeColors.surface }} />
      </View>

      {/* Chat Menu Dropdown (block) */}
      <DropdownMenu
        visible={chatMenuVisible}
        onClose={() => setChatMenuVisible(false)}
        items={[
          {
            key: 'block',
            label: chat.isBlocked ? 'Unblock User' : 'Block User',
            icon: chat.isBlocked ? 'person-add-outline' : 'ban-outline',
            onPress: () => { setChatMenuVisible(false); chat.handleBlockPress(headerName); },
            destructive: !chat.isBlocked,
          },
        ] as DropdownMenuItem[]}
      />

      {/* Message Menu Dropdown (Reply / Delete) */}
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

      {/* Reaction Picker for chat messages */}
      <ReactionPicker
        visible={reactions.reactionPickerVisible}
        onSelect={reactions.handleReactionSelect}
        onClose={reactions.handleReactionPickerClose}
        currentType={reactions.reactionTargetMessageRef.current ? reactions.getUserReactionType(reactions.reactionTargetMessageRef.current) : null}
        anchor={reactions.reactionPickerAnchor}
      />

      {/* Image Viewer */}
      <MediaViewer
        visible={menu.mediaViewerVisible}
        images={menu.mediaViewerImages}
        initialIndex={menu.mediaViewerIndex}
        onClose={menu.closeMediaViewer}
      />
    </>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  chatArea: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    minHeight: 52,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  headerBackButton: {
    width: sizing.iconButton,
    height: sizing.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizing.iconButton / 2,
  },

  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },

  headerTextColumn: {
    flexShrink: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
  },

  headerSubtitle: {
    fontSize: typography.size.xs,
    marginTop: 1,
  },

  headerLoader: {
    marginLeft: spacing.xs,
  },

  headerGearButton: {
    width: sizing.iconButton,
    height: sizing.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: sizing.iconButton / 2,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  listContent: {
    paddingVertical: spacing.md,
  },

  // Empty compose state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },

  emptyName: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.sm,
  },

  emptyHint: {
    fontSize: typography.size.md,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Load older messages
  loadOlderContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },

  loadOlderText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  // Blocked state
  blockedContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    gap: spacing.sm,
  },

  blockedTitle: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
    textAlign: 'center',
  },

  blockedDescription: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  unblockButton: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: sizing.borderRadius.lg,
    borderWidth: 1,
    minWidth: 160,
    alignItems: 'center',
  },

  unblockButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
});
