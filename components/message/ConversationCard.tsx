// =============================================================================
// CONVERSATION CARD - Thread list item for messages screen
// =============================================================================
// Displays a conversation preview with:
// - Other participant's avatar (from thread.info)
// - Name and last message preview
// - Timestamp
// - Unread indicator
// =============================================================================

import { Avatar } from '@/components/common/Avatar';
import { UserDisplayName } from '@/components/common/UserDisplayName';
import { spacing, typography, sizing } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import {
  ChatThread,
  getLastMessage,
  getMessagePreview,
  getThreadAvatar,
  getThreadBadgeSlugs,
  getThreadDisplayName,
  isThreadVerified,
} from '@/types/message';
import { formatRelativeTime, isUserOnline } from '@/utils/formatDate';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { AnimatedPressable } from '@/components/common/AnimatedPressable';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ConversationCardProps {
  thread: ChatThread;
  currentUserId: number;
  isUnread?: boolean;
  onPress?: (thread: ChatThread) => void;
  onDelete?: (thread: ChatThread) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ConversationCard({
  thread,
  currentUserId,
  isUnread = false,
  onPress,
  onDelete,
}: ConversationCardProps) {
  const { colors: themeColors } = useTheme();
  const swipeableRef = useRef<Swipeable>(null);

  // Get display data from thread.info (v2.2.0)
  const displayName = getThreadDisplayName(thread);
  const avatarUrl = getThreadAvatar(thread);
  const lastMessage = getLastMessage(thread);
  const verified = isThreadVerified(thread);
  const badgeSlugs = getThreadBadgeSlugs(thread);
  const online = isUserOnline(thread.info?.last_activity);

  // Message preview
  const messagePreview = lastMessage
    ? getMessagePreview(lastMessage.text, 60)
    : 'No messages yet';

  // Timestamp
  const timestamp = lastMessage
    ? formatRelativeTime(lastMessage.created_at)
    : formatRelativeTime(thread.created_at);

  // Is the last message from current user?
  const isOwnLastMessage = lastMessage && Number(lastMessage.user_id) === currentUserId;

  // ---------------------------------------------------------------------------
  // Swipe Delete Action
  // ---------------------------------------------------------------------------

  const handleDelete = () => {
    swipeableRef.current?.close();
    onDelete?.(thread);
  };

  const renderDeleteAction = (
    _progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    const translateX = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.swipeAction,
          { backgroundColor: themeColors.error, transform: [{ translateX }] },
        ]}
      >
        <Pressable style={styles.swipeActionButton} onPress={handleDelete}>
          <Ionicons name="trash" size={20} color={themeColors.textInverse} />
          <Text style={[styles.swipeActionText, { color: themeColors.textInverse }]}>Delete</Text>
        </Pressable>
      </Animated.View>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const cardContent = (
      <AnimatedPressable
        style={[styles.container, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}
        onPress={() => onPress?.(thread)}
      >
        {/* Avatar */}
        <Avatar
          source={avatarUrl}
          size="lg"
          fallback={displayName}
          online={online}
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Header Row: Name + Timestamp */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              {isUnread && <View style={[styles.unreadDot, { backgroundColor: themeColors.primary }]} />}
              <UserDisplayName
                name={displayName}
                verified={verified}
                badgeSlugs={badgeSlugs}
                numberOfLines={1}
                bold={isUnread ? undefined : true}
                style={styles.nameContainer}
              />
            </View>
            <Text style={[styles.timestamp, { color: themeColors.textTertiary }]}>{timestamp}</Text>
          </View>

          {/* Message Preview */}
          <View style={styles.previewRow}>
            {isOwnLastMessage && (
              <Text style={[styles.youPrefix, { color: themeColors.textSecondary }]}>You: </Text>
            )}
            <Text style={[styles.preview, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {messagePreview}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        <Ionicons
          name="chevron-forward"
          size={16}
          color={themeColors.textTertiary}
          style={styles.chevron}
        />
      </AnimatedPressable>
  );

  if (onDelete) {
    return (
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderDeleteAction}
        rightThreshold={40}
        overshootRight={false}
      >
        {cardContent}
      </Swipeable>
    );
  }

  return cardContent;
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
  },

  content: {
    flex: 1,
    marginLeft: spacing.md,
    justifyContent: 'center',
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },

  nameContainer: {
    flexShrink: 1,
    flexWrap: 'nowrap',
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: sizing.borderRadius.full,
    marginRight: spacing.xs,
  },

  timestamp: {
    fontSize: typography.size.xs,
  },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  youPrefix: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },

  preview: {
    flex: 1,
    fontSize: typography.size.sm,
    lineHeight: 18,
  },

  chevron: {
    marginLeft: spacing.sm,
  },

  // Swipe Actions
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },

  swipeActionButton: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  swipeActionText: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    marginTop: spacing.xs,
  },

});

export default ConversationCard;
