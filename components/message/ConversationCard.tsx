// =============================================================================
// CONVERSATION CARD - Thread list item for messages screen
// =============================================================================
// Displays a conversation preview with:
// - Other participant's avatar
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
  getOtherParticipants,
  getThreadAvatar,
  getThreadDisplayName,
} from '@/types/message';
import { formatRelativeTime } from '@/utils/formatDate';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface ConversationCardProps {
  thread: ChatThread;
  currentUserId: number;
  isUnread?: boolean;
  onPress?: (thread: ChatThread) => void;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ConversationCard({
  thread,
  currentUserId,
  isUnread = false,
  onPress,
}: ConversationCardProps) {
  const { colors: themeColors } = useTheme();

  // Get display data
  const displayName = getThreadDisplayName(thread, currentUserId);
  const avatarUrl = getThreadAvatar(thread, currentUserId);
  const lastMessage = getLastMessage(thread);
  const otherParticipants = getOtherParticipants(thread, currentUserId);
  const isVerified = otherParticipants.length === 1 && otherParticipants[0]?.is_verified === 1;

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
  // Render
  // ---------------------------------------------------------------------------

  return (
      <Pressable
        style={[styles.container, { backgroundColor: themeColors.surface, borderBottomColor: themeColors.border }]}
        onPress={() => onPress?.(thread)}
      >
        {/* Avatar */}
        <Avatar
          source={avatarUrl}
          size="lg"
          fallback={displayName}
        />

        {/* Content */}
        <View style={styles.content}>
          {/* Header Row: Name + Timestamp */}
          <View style={styles.headerRow}>
            {isUnread && <View style={[styles.unreadDot, { backgroundColor: themeColors.primary }]} />}
            <Text style={[styles.name, { color: themeColors.text }, isUnread && styles.nameUnread]} numberOfLines={1}>
              {displayName}
            </Text>
            {isVerified && <VerifiedBadge size={14} />}
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

});

export default ConversationCard;
