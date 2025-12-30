// =============================================================================
// NOTIFICATIONS API - All notification-related API calls
// =============================================================================

import { DEFAULT_PER_PAGE, ENDPOINTS } from '@/constants/config';
import {
    DeleteNotificationResponse,
    GetNotificationsOptions,
    MarkAllReadResponse,
    MarkReadResponse,
    NotificationsResponse,
    UnreadNotificationsResponse,
} from '@/types';
import { del, get, post } from './client';

// -----------------------------------------------------------------------------
// Get All Notifications (paginated)
// -----------------------------------------------------------------------------

export async function getNotifications(options: GetNotificationsOptions = {}) {
  const params: Record<string, any> = {
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

  return get<NotificationsResponse>(ENDPOINTS.NOTIFICATIONS, params);
}

// -----------------------------------------------------------------------------
// Get Unread Notifications with Count
// -----------------------------------------------------------------------------
// Returns unread notifications and total unread count for badge

export async function getUnreadNotifications() {
  return get<UnreadNotificationsResponse>(ENDPOINTS.NOTIFICATIONS_UNREAD);
}

// -----------------------------------------------------------------------------
// Get Unread Count Only
// -----------------------------------------------------------------------------
// Convenience function that just returns the count number

export async function getUnreadCount(): Promise<number> {
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
// Delete Single Notification
// -----------------------------------------------------------------------------

export async function deleteNotification(notificationId: number) {
  return del<DeleteNotificationResponse>(ENDPOINTS.NOTIFICATIONS_DELETE(notificationId));
}

// -----------------------------------------------------------------------------
// Delete All Notifications
// -----------------------------------------------------------------------------

export async function deleteAllNotifications() {
  return del<DeleteNotificationResponse>(ENDPOINTS.NOTIFICATIONS_DELETE_ALL);
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const notificationsApi = {
  getNotifications,
  getUnreadNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
};

export default notificationsApi;