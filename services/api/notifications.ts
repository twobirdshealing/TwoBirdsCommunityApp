// =============================================================================
// NOTIFICATIONS API - All notification-related API calls
// =============================================================================

import { DEFAULT_PER_PAGE, ENDPOINTS } from '@/constants/config';
import {
  GetNotificationsOptions,
  MarkAllReadResponse,
  MarkReadResponse,
  NotificationsResponse,
  UnreadNotificationsResponse,
  transformNotification,
} from '@/types/notification';
import { get, post } from './client';

// -----------------------------------------------------------------------------
// Transform Response Helpers
// -----------------------------------------------------------------------------

/** Raw paginated notifications from API (before transform) */
interface RawNotificationsResponse {
  notifications: {
    current_page: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw API data passed to transformNotification
    data: Record<string, any>[];
    [key: string]: unknown;
  };
}

/** Raw unread notifications from API (before transform) */
interface RawUnreadResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw API data passed to transformNotification
  notifications: Record<string, any>[];
  unread_count: number;
}

/**
 * Transform paginated notifications response
 * Applies transformNotification to each notification in the data array
 */
function transformNotificationsResponse(response: RawNotificationsResponse): NotificationsResponse {
  const notifications = response.notifications || { current_page: 1, data: [] };
  const data = notifications.data || [];

  return {
    notifications: {
      ...notifications,
      data: data.map((n) => transformNotification(n)),
    },
  } as NotificationsResponse;
}

/**
 * Transform unread notifications response
 */
function transformUnreadResponse(response: RawUnreadResponse): UnreadNotificationsResponse {
  const notifications = response.notifications || [];

  return {
    notifications: notifications.map((n) => transformNotification(n)),
    unread_count: response.unread_count || 0,
  };
}

// -----------------------------------------------------------------------------
// Get All Notifications (paginated)
// -----------------------------------------------------------------------------

export async function getNotifications(options: GetNotificationsOptions = {}) {
  const params: Record<string, string | number | boolean> = {
    page: options.page || 1,
    per_page: options.per_page || DEFAULT_PER_PAGE,
  };

  // Optional filters
  if (options.is_read !== undefined) {
    params.is_read = options.is_read;
  }
  if (options.type) {
    params.type = options.type;
  }
  if (options.orderby) {
    params.orderby = options.orderby;
  }
  if (options.order) {
    params.order = options.order;
  }

  const result = await get<RawNotificationsResponse>(ENDPOINTS.NOTIFICATIONS, params);

  // Transform the response if successful
  if (result.success) {
    return {
      success: true as const,
      data: transformNotificationsResponse(result.data),
    };
  }

  return result;
}

// -----------------------------------------------------------------------------
// Get Unread Notifications with Count
// -----------------------------------------------------------------------------
// Returns unread notifications and total unread count for badge

export async function getUnreadNotifications() {
  const result = await get<RawUnreadResponse>(ENDPOINTS.NOTIFICATIONS_UNREAD);

  // Transform the response if successful
  if (result.success) {
    return {
      success: true as const,
      data: transformUnreadResponse(result.data),
    };
  }

  return result;
}

// -----------------------------------------------------------------------------
// Get Unread Count Only
// -----------------------------------------------------------------------------
// Convenience function that just returns the count number

export async function getNotificationUnreadCount(): Promise<number> {
  const response = await getUnreadNotifications();
  if (response.success) {
    return response.data.unread_count;
  }
  return 0;
}

// -----------------------------------------------------------------------------
// Mark Single Notification as Read
// -----------------------------------------------------------------------------

export async function markAsRead(notificationId: number) {
  return post<MarkReadResponse>(ENDPOINTS.NOTIFICATIONS_MARK_READ(notificationId));
}

// -----------------------------------------------------------------------------
// Mark All Notifications as Read
// -----------------------------------------------------------------------------

export async function markAllAsRead() {
  return post<MarkAllReadResponse>(ENDPOINTS.NOTIFICATIONS_MARK_ALL_READ);
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const notificationsApi = {
  getNotifications,
  getUnreadNotifications,
  getNotificationUnreadCount,
  markAsRead,
  markAllAsRead,
};

export default notificationsApi;