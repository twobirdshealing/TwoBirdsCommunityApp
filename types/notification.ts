// =============================================================================
// NOTIFICATION TYPES - TypeScript definitions for notifications
// =============================================================================
// These types match the Fluent Community API response structure.
// =============================================================================

import { XProfile } from './user';

// -----------------------------------------------------------------------------
// Notification Types (from API)
// -----------------------------------------------------------------------------

export type NotificationType =
  | 'new_comment'      // New comment on user's feed
  | 'new_reply'        // Reply to user's comment
  | 'new_reaction'     // Reaction on user's content
  | 'new_follower'     // New follower [PRO]
  | 'mention'          // User mentioned in content
  | 'space_invite'     // Invited to a space
  | 'space_join'       // User joined a space
  | 'course_enrollment' // Enrolled in a course
  | 'lesson_complete'  // Lesson completed
  | string;            // Allow unknown types for forward compatibility

// -----------------------------------------------------------------------------
// Notification Object
// -----------------------------------------------------------------------------

export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  action_url: string | null;
  is_read: boolean;
  actor_id: number | null;
  object_id: number | null;
  object_type: string | null;
  created_at: string;
  read_at: string | null;

  // Actor's profile (the user who triggered the notification)
  xprofile?: XProfile;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

// Paginated notifications list response
export interface NotificationsResponse {
  notifications: {
    current_page: number;
    data: Notification[];
    first_page_url: string;
    from: number | null;
    last_page: number;
    last_page_url: string;
    links: Array<{
      url: string | null;
      label: string;
      active: boolean;
    }>;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number | null;
    total: number;
  };
}

// Unread notifications response (includes count)
export interface UnreadNotificationsResponse {
  notifications: Notification[];
  unread_count: number;
}

// Mark as read response
export interface MarkReadResponse {
  message: string;
  data: {
    id: number;
    is_read: boolean;
    read_at: string;
  };
}

// Mark all as read response
export interface MarkAllReadResponse {
  message: string;
  data: {
    marked_count: number;
  };
}

// Delete notification response
export interface DeleteNotificationResponse {
  message: string;
}

// -----------------------------------------------------------------------------
// Request Options
// -----------------------------------------------------------------------------

export interface GetNotificationsOptions {
  page?: number;
  per_page?: number;
  is_read?: boolean;
  type?: NotificationType;
  orderby?: 'created_at' | 'read_at';
  order?: 'asc' | 'desc';
}