// =============================================================================
// NOTIFICATION TYPE ICON - Icon based on notification type
// =============================================================================
// Returns appropriate icon and color for each notification type.
// Used in NotificationCard and potentially notification toasts.
// Supports both legacy types (new_comment) and action types (feed/commented)
// For reaction notifications, renders the reaction emoji/icon from the
// notification payload when available.
// =============================================================================

import { ColorTheme, withOpacity } from '@/constants/colors';
import { useTheme } from '@/contexts/ThemeContext';
import { NotificationAction } from '@/types/notification';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NotificationActionIconProps {
  type: NotificationAction;
  /** Reaction type (e.g. 'laugh', 'wow') */
  reactionType?: string;
  /** Custom icon URL for the reaction (uploaded image) */
  reactionIconUrl?: string | null;
  /** Emoji fallback for the reaction */
  reactionEmoji?: string | null;
  size?: number;
}

// -----------------------------------------------------------------------------
// Icon & Color Mapping
// -----------------------------------------------------------------------------

interface IconConfig {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  backgroundColor: string;
}

function getIconConfig(type: NotificationAction, tc: ColorTheme): IconConfig {
  // Handle action-style types (e.g., "feed/mentioned")
  const normalizedType = type?.toLowerCase() || '';

  // Comment types
  if (normalizedType === 'new_comment' ||
      normalizedType.includes('comment') ||
      normalizedType === 'feed/commented') {
    return {
      icon: 'chatbubble',
      color: tc.info,
      backgroundColor: tc.infoLight,
    };
  }

  // Reply types
  if (normalizedType === 'new_reply' ||
      normalizedType.includes('reply') ||
      normalizedType.includes('replied') ||
      normalizedType === 'feed/replied') {
    return {
      icon: 'arrow-undo',
      color: tc.info,
      backgroundColor: tc.infoLight,
    };
  }

  // Reaction types
  if (normalizedType === 'new_reaction' ||
      normalizedType.includes('react') ||
      normalizedType === 'feed/reacted') {
    return {
      icon: 'heart',
      color: tc.error,
      backgroundColor: tc.errorLight,
    };
  }

  // Follower posted types
  if (normalizedType === 'follower_new_post' ||
      normalizedType === 'follower_post') {
    return {
      icon: 'document-text',
      color: tc.primary,
      backgroundColor: withOpacity(tc.primary, 0.19),
    };
  }

  // Follower types
  if (normalizedType === 'new_follower' ||
      normalizedType.includes('follow') ||
      normalizedType === 'profile/followed') {
    return {
      icon: 'person-add',
      color: tc.success,
      backgroundColor: tc.successLight,
    };
  }

  // Mention types
  if (normalizedType === 'mention' ||
      normalizedType.includes('mention') ||
      normalizedType === 'feed/mentioned') {
    return {
      icon: 'at',
      color: tc.warning,
      backgroundColor: tc.warningLight,
    };
  }

  // Space invite types
  if (normalizedType === 'space_invite' ||
      normalizedType.includes('invite') ||
      normalizedType === 'space/invited') {
    return {
      icon: 'mail',
      color: tc.primary,
      backgroundColor: withOpacity(tc.primary, 0.19),
    };
  }

  // Space join types
  if (normalizedType === 'space_join' ||
      normalizedType === 'space/joined') {
    return {
      icon: 'people',
      color: tc.success,
      backgroundColor: tc.successLight,
    };
  }

  // Course enrollment types
  if (normalizedType === 'course_enrollment' ||
      normalizedType.includes('enroll') ||
      normalizedType === 'course/enrolled') {
    return {
      icon: 'school',
      color: tc.primary,
      backgroundColor: withOpacity(tc.primary, 0.19),
    };
  }

  // Lesson complete types
  if (normalizedType === 'lesson_complete' ||
      normalizedType.includes('complete') ||
      normalizedType === 'lesson/completed') {
    return {
      icon: 'checkmark-circle',
      color: tc.success,
      backgroundColor: tc.successLight,
    };
  }

  // Default fallback
  return {
    icon: 'notifications',
    color: tc.textSecondary,
    backgroundColor: tc.backgroundSecondary,
  };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export const NotificationActionIcon = React.memo(function NotificationActionIcon({
  type,
  reactionType,
  reactionIconUrl,
  reactionEmoji,
  size = 20,
}: NotificationActionIconProps) {
  const { colors: themeColors } = useTheme();
  const config = getIconConfig(type, themeColors);
  const containerSize = size * 1.8;

  // For reaction notifications with type data, show the actual reaction icon/emoji
  const isReaction = config.icon === 'heart' && reactionType;

  if (isReaction && (reactionIconUrl || reactionEmoji)) {
    return (
      <View
        style={[
          styles.container,
          {
            width: containerSize,
            height: containerSize,
            borderRadius: containerSize / 2,
            backgroundColor: 'transparent',
          },
        ]}
      >
        {reactionIconUrl ? (
          <Image
            source={{ uri: reactionIconUrl }}
            style={{ width: containerSize, height: containerSize, borderRadius: containerSize / 2 }}
            resizeMode="contain"
          />
        ) : (
          <Text style={{ fontSize: containerSize * 0.75, lineHeight: containerSize, textAlign: 'center' }}>
            {reactionEmoji}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: containerSize,
          height: containerSize,
          borderRadius: containerSize / 2,
          backgroundColor: config.backgroundColor,
        },
      ]}
    >
      <Ionicons name={config.icon} size={size} color={config.color} />
    </View>
  );
});

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NotificationActionIcon;
