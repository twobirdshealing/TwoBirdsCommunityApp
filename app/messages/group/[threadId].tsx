// =============================================================================
// GROUP CHAT SCREEN - Chat detail for a group thread
// =============================================================================
// Route: /messages/group/[threadId]
// All shared chat scaffolding (FlashList, ChatInput, message-level menu,
// MediaViewer, ChatReactionPicker, header chrome) lives in ChatScreenLayout.
// This file owns only what's group-specific: the GroupHeader, the right-side
// "open info sheet" button, the GroupInfoSheet, and the onGroupExit handler.
// =============================================================================

import { ChatScreenLayout } from '@/components/message/ChatScreenLayout';
import { GroupHeader } from '@/components/message/GroupHeader';
import { GroupInfoSheet } from '@/components/message/GroupInfoSheet';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { useAuth } from '@/contexts/AuthContext';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatReactions } from '@/hooks/useChatReactions';
import { useMessageMenu } from '@/hooks/useMessageMenu';
import { isGroupAdmin } from '@/types/message';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

export default function GroupChatScreen() {
  const router = useRouter();
  const { threadId: threadIdParam, title: titleParam } = useLocalSearchParams<{
    threadId: string;
    title?: string;
  }>();
  const { user } = useAuth();
  const knownThreadId = threadIdParam ? parseInt(threadIdParam, 10) : null;
  const currentUserId = user?.id || 0;

  const listRef = useRef<any>(null);
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);

  const handleGroupExit = useCallback(
    (reason: 'deleted' | 'removed') => {
      const message =
        reason === 'deleted'
          ? 'This group has been deleted.'
          : 'You were removed from this group.';
      Alert.alert('Group unavailable', message, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    [router]
  );

  const chat = useChatMessages({
    threadType: 'group',
    threadId: knownThreadId ?? 0,
    currentUserId,
    listRef,
    onGroupExit: handleGroupExit,
  });

  const reactions = useChatReactions({
    currentUserId,
    setMessages: chat.setMessages,
  });

  const menu = useMessageMenu({
    messages: chat.messages,
    listRef,
  });

  const headerTitle = chat.threadDetails?.title
    || chat.threadDetails?.info?.title
    || titleParam
    || 'Group';
  const headerIcon = chat.threadDetails?.info?.photo
    || chat.threadDetails?.meta?.icon
    || null;
  const memberCount = chat.threadDetails?.total_members ?? 0;
  const userIsAdmin = isGroupAdmin(chat.threadDetails);

  // Fired after admin actions complete — re-emit so the inbox refetches the
  // member-count / title for this group's row.
  const handleGroupMutated = useCallback(() => {
    cacheEvents.emit(CACHE_EVENTS.THREADS);
  }, []);

  return (
    <ChatScreenLayout
      chat={chat}
      reactions={reactions}
      menu={menu}
      currentUserId={currentUserId}
      listRef={listRef}
      showAvatarOnEveryReceived
      headerCenter={
        <GroupHeader
          title={headerTitle}
          iconUrl={headerIcon}
          memberCount={memberCount}
          loading={chat.loading}
          onPress={() => setInfoSheetVisible(true)}
        />
      }
      headerRight={
        <HeaderIconButton icon="people-outline" onPress={() => setInfoSheetVisible(true)} />
      }
    >
      {knownThreadId !== null && (
        <GroupInfoSheet
          visible={infoSheetVisible}
          onClose={() => setInfoSheetVisible(false)}
          threadId={knownThreadId}
          threadTitle={headerTitle}
          isAdmin={userIsAdmin}
          currentUserId={currentUserId}
          onMutated={handleGroupMutated}
          onLeftOrDeleted={() => {
            setInfoSheetVisible(false);
            cacheEvents.emit(CACHE_EVENTS.THREADS);
            router.back();
          }}
        />
      )}
    </ChatScreenLayout>
  );
}
