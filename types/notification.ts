// =============================================================================
// NOTIFICATION TYPES - TypeScript definitions for notifications
// =============================================================================
// These types match the Fluent Community API response structure.
// =============================================================================

import { XProfile } from './user';

// -----------------------------------------------------------------------------
// Notification Types (from API action field)
// -----------------------------------------------------------------------------

// API returns action strings like "feed/mentioned", "feed/commented", etc.
export type NotificationAction =
  | 'feed/mentioned'
  | 'feed/commented'
  | 'feed/replied'
  | 'feed/reacted'
  | 'profile/followed'
  | 'space/invited'
  | 'space/joined'
  | 'course/enrolled'
  | 'lesson/completed'
  | string;

// Legacy type alias for backwards compatibility
export type NotificationType = NotificationAction;

// -----------------------------------------------------------------------------
// Route Object (for navigation)
// -----------------------------------------------------------------------------

export interface NotificationRoute {
  name: string;
  params: Record<string, string | number>;
}

// -----------------------------------------------------------------------------
// Subscriber Object (notification metadata)
// -----------------------------------------------------------------------------

export interface NotificationSubscriber {
  id: number;
  object_id: number;
  user_id: number;
  is_read: string; // "0" or "1" from API
  created_at: string;
  updated_at: string;
}

// -----------------------------------------------------------------------------
// Notification Object (actual API response)
// -----------------------------------------------------------------------------

export interface AppNotification {
  // Content
  content: string;           // HTML content from API
  action: NotificationAction; // e.g., "feed/mentioned"

  // Navigation
  route?: NotificationRoute;  // For app navigation

  // Metadata (from subscriber object)
  subscriber: NotificationSubscriber;

  // Actor's profile (the user who triggered the notification)
  xprofile?: XProfile;

  // ----- Computed properties (added by app) -----
  // These are populated by transformNotification()
  id: number;                 // From subscriber.id
  is_read: boolean;           // Parsed from subscriber.is_read
  created_at: string;         // From subscriber.created_at
  type: NotificationAction;   // Alias for action

  // Legacy fields (for backwards compatibility)
  message?: string;           // Stripped HTML from content
  title?: string;             // First line of message
  action_url?: string | null; // Built from route
  actor_id?: number | null;
  object_id?: number | null;
  object_type?: string | null;
  read_at?: string | null;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

// Paginated notifications list response
export interface NotificationsResponse {
  notifications: {
    current_page: number;
    data: AppNotification[];
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
  notifications: AppNotification[];
  unread_count: number;
}

// Mark as read response
export interface MarkReadResponse {
  message: string;
  data?: {
    id: number;
    is_read: boolean;
    read_at: string;
  };
}

// Mark all as read response
export interface MarkAllReadResponse {
  message: string;
  data?: {
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
  type?: NotificationAction;
  orderby?: 'created_at' | 'read_at';
  order?: 'asc' | 'desc';
}

// -----------------------------------------------------------------------------
// Transform Helper
// -----------------------------------------------------------------------------

/**
 * Strip HTML tags from content string
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp;
    .replace(/&amp;/g, '&')  // Replace &amp;
    .replace(/&lt;/g, '<')   // Replace &lt;
    .replace(/&gt;/g, '>')   // Replace &gt;
    .replace(/&quot;/g, '"') // Replace &quot;
    .replace(/&#39;/g, "'")  // Replace &#39;
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .trim();
}

/**
 * Transform API notification to app-friendly format
 * Populates computed properties from raw API response
 */
export function transformNotification(raw: any): AppNotification {
  const subscriber = raw.subscriber || {};

  return {
    // Pass through raw data
    content: raw.content || '',
    action: raw.action || '',
    route: raw.route,
    subscriber: subscriber,
    xprofile: raw.xprofile,

    // Computed properties
    id: subscriber.id || raw.id || 0,
    is_read: subscriber.is_read === '1' || subscriber.is_read === 1 || subscriber.is_read === true,
    created_at: subscriber.created_at || raw.created_at || '',
    type: raw.action || '',

    // Legacy/convenience
    message: stripHtml(raw.content || ''),
    title: stripHtml(raw.content || '').split('\n')[0],
    action_url: null, // We use route instead
    actor_id: raw.xprofile?.user_id || null,
    object_id: subscriber.object_id || null,
    object_type: null,
    read_at: null,
  };
}
