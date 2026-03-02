// =============================================================================
// NOTIFICATION MAP - Static config data for notification settings screen
// =============================================================================
// Links push notification type IDs to email preference keys, grouped by
// category. Also includes frequency options and space email pref options.
// =============================================================================

import { PushPreference } from '@/services/api/push';
import { EmailUserGlobals } from '@/services/api/emailPrefs';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CategoryPreferences {
  [category: string]: PushPreference[];
}

export type ChannelType = 'push' | 'email';

export interface ChannelInfo {
  type: ChannelType;
  id: string;
  label: string;
  enabled: boolean;
}

export interface UnifiedItem {
  key: string;
  label: string;
  description: string;
  channels: ChannelInfo[];
  note?: string;
}

export interface UnifiedSection {
  category: string;
  title: string;
  items: UnifiedItem[];
}

export type SpacePrefValue = '' | 'admin_only_posts' | 'all_member_posts';

export interface NotificationMapping {
  key: string;
  label: string;
  description: string;
  category: string;
  pushIds?: string[];
  pushLabels?: string[];
  emailKey?: keyof EmailUserGlobals;
  note?: string;
}

// -----------------------------------------------------------------------------
// Notification Mapping — links push type IDs to email pref keys
// -----------------------------------------------------------------------------

export const NOTIFICATION_MAP: NotificationMapping[] = [
  // Community — dual channel
  {
    key: 'comment_on_post',
    label: 'Comment on Your Post',
    description: 'When someone comments on your post',
    category: 'community',
    pushIds: ['comment_on_post'],
    emailKey: 'com_my_post_mail',
  },
  {
    key: 'reply_to_comment',
    label: 'Reply to Your Comment',
    description: 'When someone replies to your comment',
    category: 'community',
    pushIds: ['reply_to_comment'],
    emailKey: 'reply_my_com_mail',
  },
  {
    key: 'mentions',
    label: 'Mentions',
    description: 'When someone mentions you in a post or comment',
    category: 'community',
    pushIds: ['mentioned_in_comment', 'mentioned_in_post'],
    pushLabels: ['In comments', 'In posts'],
    emailKey: 'mention_mail',
    note: 'Email setting also controls announcement emails',
  },
  // Community — push only
  {
    key: 'reactions',
    label: 'Reactions',
    description: 'When someone reacts to your posts or comments',
    category: 'community',
    pushIds: ['reaction_on_post', 'reaction_on_comment'],
    pushLabels: ['On your posts', 'On your comments'],
  },
  {
    key: 'comment_on_followed_post',
    label: 'Comment on Followed Post',
    description: 'When someone comments on a post you follow',
    category: 'community',
    pushIds: ['comment_on_followed_post'],
  },
  {
    key: 'new_space_post',
    label: 'New Post in Your Space',
    description: 'When a new post is created in a space you belong to',
    category: 'community',
    pushIds: ['new_space_post'],
  },
  {
    key: 'space_join',
    label: 'Someone Joined Your Space',
    description: 'When someone joins a space you moderate',
    category: 'community',
    pushIds: ['space_join'],
  },
  {
    key: 'space_role_change',
    label: 'Your Role Changed',
    description: 'When your role is changed in a space',
    category: 'community',
    pushIds: ['space_role_change'],
  },
  {
    key: 'invitation_received',
    label: 'Invitation Received',
    description: 'When you receive an invitation',
    category: 'community',
    pushIds: ['invitation_received'],
  },
  {
    key: 'course_enrolled',
    label: 'Course Enrollment',
    description: 'When you are enrolled in a course',
    category: 'community',
    pushIds: ['course_enrolled'],
  },
  // Social — push only
  {
    key: 'friend_new_post',
    label: 'Friend Posted',
    description: 'When someone you follow creates a new post',
    category: 'social',
    pushIds: ['friend_new_post'],
  },
  {
    key: 'new_follower',
    label: 'New Follower',
    description: 'When someone follows you',
    category: 'social',
    pushIds: ['new_follower'],
  },
  {
    key: 'level_up',
    label: 'You Leveled Up',
    description: 'When you reach a new level',
    category: 'social',
    pushIds: ['level_up'],
  },
  {
    key: 'points_earned',
    label: 'Points Earned',
    description: 'When you earn points',
    category: 'social',
    pushIds: ['points_earned'],
  },
  {
    key: 'quiz_result',
    label: 'Quiz Submitted',
    description: 'When a quiz is submitted',
    category: 'social',
    pushIds: ['quiz_result'],
  },
  // Messaging — push only
  {
    key: 'new_direct_message',
    label: 'Direct Messages',
    description: 'When someone sends you a direct message',
    category: 'messaging',
    pushIds: ['new_direct_message'],
  },
];

// Category display order and titles
export const CATEGORY_CONFIG: Record<string, string> = {
  community: 'Community',
  social: 'Social',
  messaging: 'Messaging',
};

// Frequency options for DM emails
export const FREQUENCY_OPTIONS: { value: string; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'disabled', label: 'Off' },
];

// Space email pref options
export const SPACE_PREF_OPTIONS: { value: SpacePrefValue; label: string }[] = [
  { value: '', label: 'Off' },
  { value: 'admin_only_posts', label: 'Admin Posts' },
  { value: 'all_member_posts', label: 'All Posts' },
];
