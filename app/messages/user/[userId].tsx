// =============================================================================
// USER CHAT SCREEN - Chat addressed by user ID
// =============================================================================
// Route: /messages/user/[userId]
// Resolves an existing thread with this user (or shows the empty-compose
// state for first message). All shared chat scaffolding lives in
// ChatScreenLayout — this file owns the user-specific header, the chat-level
// settings menu (block/unblock), and the blocked-thread footer.
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { DropdownMenu } from '@/components/common/DropdownMenu';
import type { DropdownMenuItem } from '@/components/common/DropdownMenu';
import { ChatScreenLayout } from '@/components/message/ChatScreenLayout';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatReactions } from '@/hooks/useChatReactions';
import { useMessageMenu } from '@/hooks/useMessageMenu';
import { isUserOnline, formatLastActivity } from '@/utils/formatDate';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function UserChatScreen() {
  const router = useRouter();
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

  const listRef = useRef<any>(null);

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

  // Chat-level menu (settings gear → Block/Unblock)
  const [chatMenuVisible, setChatMenuVisible] = useState(false);

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

  const handleHeaderPress = () => {
    if (headerUsername) {
      router.push(`/profile/${headerUsername}` as any);
    }
  };

  // ---------------------------------------------------------------------------
  // Header center, footer override, and empty state
  // ---------------------------------------------------------------------------

  const headerCenter = (
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

  const blockedFooter = (
    <View style={[styles.blockedContainer, { borderTopColor: themeColors.border }]}>
      <Text style={[styles.blockedTitle, { color: themeColors.text }]}>
        You blocked messages from {headerName}
      </Text>
      <Text style={[styles.blockedDescription, { color: themeColors.textSecondary }]}>
        You can&apos;t send or receive messages in this chat unless you unblock the user.
      </Text>
      <Pressable
        style={[styles.unblockButton, { borderColor: themeColors.border }]}
        onPress={chat.handleUnblockPress}
        disabled={chat.blockLoading}
      >
        {chat.blockLoading ? (
          <ActivityIndicator size="small" color={themeColors.text} />
        ) : (
          <Text style={[styles.unblockButtonText, { color: themeColors.text }]}>Unblock User</Text>
        )}
      </Pressable>
    </View>
  );

  const emptyCompose = (
    <View style={styles.emptyContainer}>
      <Avatar source={headerAvatar} size="lg" fallback={headerName} />
      <Text style={[styles.emptyName, { color: themeColors.text }]}>{headerName}</Text>
      <Text style={[styles.emptyHint, { color: themeColors.textSecondary }]}>
        Start a chat session with {headerName} by sending the first message.
      </Text>
    </View>
  );

  return (
    <ChatScreenLayout
      chat={chat}
      reactions={reactions}
      menu={menu}
      currentUserId={currentUserId}
      listRef={listRef}
      headerCenter={headerCenter}
      headerRight={
        <HeaderIconButton icon="settings-outline" onPress={() => setChatMenuVisible(true)} />
      }
      footerOverride={chat.isBlocked ? blockedFooter : undefined}
      inputPlaceholder={chat.thread ? 'Type a message...' : `Message ${headerName}...`}
      emptyState={emptyCompose}
    >
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
    </ChatScreenLayout>
  );
}

// -----------------------------------------------------------------------------
// Styles — only the user-chat-specific bits remain (header chrome, blocked
// banner, empty-compose). All shared layout styles live in ChatScreenLayout.
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
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
