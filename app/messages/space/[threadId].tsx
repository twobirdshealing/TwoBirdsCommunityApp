// =============================================================================
// SPACE CHAT SCREEN - Chat detail for a community-space thread
// =============================================================================
// Route: /messages/space/[threadId]
// Mirrors the group screen but with no admin actions and a "left chat" footer
// override when the user has left the space chat. All shared scaffolding lives
// in ChatScreenLayout.
// =============================================================================

import { ChatScreenLayout } from '@/components/message/ChatScreenLayout';
import { GroupHeader } from '@/components/message/GroupHeader';
import { SpaceInfoSheet } from '@/components/message/SpaceInfoSheet';
import { HeaderIconButton } from '@/components/navigation/HeaderIconButton';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useChatReactions } from '@/hooks/useChatReactions';
import { useMessageMenu } from '@/hooks/useMessageMenu';
import { cacheEvents, CACHE_EVENTS } from '@/utils/cacheEvents';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function SpaceChatScreen() {
  const router = useRouter();
  const { colors: themeColors } = useTheme();
  const { threadId: threadIdParam, title: titleParam, slug: slugParam, isLeft: isLeftParam } = useLocalSearchParams<{
    threadId: string;
    title?: string;
    slug?: string;
    /** "1" when navigated from `left_community_threads` so the sheet shows Rejoin. */
    isLeft?: string;
  }>();
  const { user } = useAuth();
  const knownThreadId = threadIdParam ? parseInt(threadIdParam, 10) : null;
  const currentUserId = user?.id || 0;
  const isLeft = isLeftParam === '1';

  const listRef = useRef<any>(null);
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);

  const chat = useChatMessages({
    threadType: 'space',
    threadId: knownThreadId ?? 0,
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

  const headerTitle = chat.threadDetails?.title
    || chat.threadDetails?.info?.title
    || titleParam
    || 'Community';
  const headerIcon = chat.threadDetails?.info?.photo || null;
  // Community threads expose `info.username` as the space slug on web. Fall
  // back to the route param so deep-links still work even before threadDetails
  // arrives.
  const headerSlug = (chat.threadDetails?.info?.username as string | undefined) || slugParam || null;

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
          loading={chat.loading}
          onPress={() => setInfoSheetVisible(true)}
        />
      }
      headerRight={
        <HeaderIconButton icon="people-outline" onPress={() => setInfoSheetVisible(true)} />
      }
      footerOverride={
        isLeft ? (
          <View style={[styles.leftBanner, { borderTopColor: themeColors.border }]}>
            <Text style={[styles.leftBannerText, { color: themeColors.textSecondary }]}>
              You&rsquo;ve left this community chat. Rejoin to send messages.
            </Text>
            <Pressable
              style={[styles.rejoinButton, { borderColor: themeColors.primary }]}
              onPress={() => setInfoSheetVisible(true)}
            >
              <Text style={[styles.rejoinButtonText, { color: themeColors.primary }]}>Open settings</Text>
            </Pressable>
          </View>
        ) : undefined
      }
    >
      {knownThreadId !== null && (
        <SpaceInfoSheet
          visible={infoSheetVisible}
          onClose={() => setInfoSheetVisible(false)}
          threadId={knownThreadId}
          threadTitle={headerTitle}
          spaceSlug={headerSlug}
          isLeft={isLeft}
          onMembershipChanged={() => {
            cacheEvents.emit(CACHE_EVENTS.THREADS);
            router.back();
          }}
        />
      )}
    </ChatScreenLayout>
  );
}

const styles = StyleSheet.create({
  leftBanner: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    gap: spacing.sm,
  },

  leftBannerText: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    lineHeight: 20,
  },

  rejoinButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: 16,
    borderWidth: 1,
  },

  rejoinButtonText: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.semibold,
  },
});
