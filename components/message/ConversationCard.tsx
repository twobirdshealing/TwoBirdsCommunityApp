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
import { VerifiedBadge } from '@/components/common/VerifiedBadge';
import { spacing, typography } from '@/constants/layout';
import { useTheme } from '@/contexts/ThemeContext';
import {
  ChatThread,
  getLastMessage,
  getMessagePreview,
  getThreadAvatar,
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
      <Pressable
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
            {isUnread && <View style={[styles.unreadDot, { backgroundColor: themeColors.primary }]} />}
            <Text style={[styles.name, { color: themeColors.text }, isUnread && styles.nameUnread]} numberOfLines={1}>
              {displayName}
            </Text>
            {verified && <VerifiedBadge size={14} />}
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
      </Pressable>
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
    marginBottom: 4,
  },

  name: {
    flex: 1,
    fontSize: typography.size.md,
    fontWeight: '600',
    marginRight: spacing.sm,
  },

  nameUnread: {
    fontWeight: '700',
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
    fontWeight: '500',
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
    fontWeight: '600',
    marginTop: 4,
  },

});

export default ConversationCard;
