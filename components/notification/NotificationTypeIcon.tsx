// =============================================================================
// NOTIFICATION TYPE ICON - Icon based on notification type
// =============================================================================
// Returns appropriate icon and color for each notification type.
// Used in NotificationCard and potentially notification toasts.
// Supports both legacy types (new_comment) and action types (feed/commented)
// =============================================================================

import { colors } from '@/constants/colors';
import { NotificationType } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface NotificationTypeIconProps {
  type: NotificationType;
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

function getIconConfig(type: NotificationType): IconConfig {
  // Handle action-style types (e.g., "feed/mentioned")
  const normalizedType = type?.toLowerCase() || '';

  // Comment types
  if (normalizedType === 'new_comment' ||
      normalizedType.includes('comment') ||
      normalizedType === 'feed/commented') {
    return {
      icon: 'chatbubble',
      color: colors.info,
      backgroundColor: colors.infoLight,
    };
  }

  // Reply types
  if (normalizedType === 'new_reply' ||
      normalizedType.includes('reply') ||
      normalizedType.includes('replied') ||
      normalizedType === 'feed/replied') {
    return {
      icon: 'arrow-undo',
      color: colors.info,
      backgroundColor: colors.infoLight,
    };
  }

  // Reaction types
  if (normalizedType === 'new_reaction' ||
      normalizedType.includes('react') ||
      normalizedType === 'feed/reacted') {
    return {
      icon: 'heart',
      color: colors.reactions.love,
      backgroundColor: colors.errorLight,
    };
  }

  // Follower types
  if (normalizedType === 'new_follower' ||
      normalizedType.includes('follow') ||
      normalizedType === 'profile/followed') {
    return {
      icon: 'person-add',
      color: colors.success,
      backgroundColor: colors.successLight,
    };
  }

  // Mention types
  if (normalizedType === 'mention' ||
      normalizedType.includes('mention') ||
      normalizedType === 'feed/mentioned') {
    return {
      icon: 'at',
      color: colors.warning,
      backgroundColor: colors.warningLight,
    };
  }

  // Space invite types
  if (normalizedType === 'space_invite' ||
      normalizedType.includes('invite') ||
      normalizedType === 'space/invited') {
    return {
      icon: 'mail',
      color: colors.primary,
      backgroundColor: colors.primaryLight + '30',
    };
  }

  // Space join types
  if (normalizedType === 'space_join' ||
      normalizedType === 'space/joined') {
    return {
      icon: 'people',
      color: colors.success,
      backgroundColor: colors.successLight,
    };
  }

  // Course enrollment types
  if (normalizedType === 'course_enrollment' ||
      normalizedType.includes('enroll') ||
      normalizedType === 'course/enrolled') {
    return {
      icon: 'school',
      color: colors.primary,
      backgroundColor: colors.primaryLight + '30',
    };
  }

  // Lesson complete types
  if (normalizedType === 'lesson_complete' ||
      normalizedType.includes('complete') ||
      normalizedType === 'lesson/completed') {
    return {
      icon: 'checkmark-circle',
      color: colors.success,
      backgroundColor: colors.successLight,
    };
  }

  // Default fallback
  return {
    icon: 'notifications',
    color: colors.textSecondary,
    backgroundColor: colors.backgroundSecondary,
  };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function NotificationTypeIcon({ type, size = 20 }: NotificationTypeIconProps) {
  const config = getIconConfig(type);
  const containerSize = size * 1.8;

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
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default NotificationTypeIcon;
