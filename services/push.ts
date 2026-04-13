// =============================================================================
// PUSH SERVICE - Expo push notifications registration
// =============================================================================
// Handles device token registration with Expo and our backend.
// Called on login to register, on logout to unregister.
// =============================================================================

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { registerDevice, unregisterDevice } from './api/push';
import { getFeatureFlag } from '@/utils/featureFlags';
import { createLogger } from '@/utils/logger';

const log = createLogger('Push');

// -----------------------------------------------------------------------------
// Module State
// -----------------------------------------------------------------------------

let storedPushToken: string | null = null;
let lastBadgeCount: number | null = null;

// -----------------------------------------------------------------------------
// Configure Notifications
// -----------------------------------------------------------------------------

// Set notification handler (how to show notifications when app is in foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// -----------------------------------------------------------------------------
// Get Project ID
// -----------------------------------------------------------------------------

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ??
         Constants.easConfig?.projectId;
}

// -----------------------------------------------------------------------------
// Register for Push Notifications (Get Token)
// -----------------------------------------------------------------------------

/**
 * Request push notification permissions and get Expo push token.
 * Returns null if permissions denied or not on physical device.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Must be on physical device
  if (!Device.isDevice) {
    log.debug('Push notifications require a physical device');
    return null;
  }

  // Check existing permission status
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    log.debug('Requesting push notification permission...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    log.debug('Push notification permission denied');
    return null;
  }

  log.debug('Push notification permission granted');

  // Get Expo push token
  try {
    const projectId = getProjectId();
    log.debug('Project ID:', { projectId });

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    storedPushToken = tokenData.data;
    log.debug('Got push token', { tokenPreview: storedPushToken.substring(0, 30) + '...' });

    // Android needs notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366F1',
      });
    }

    return storedPushToken;
  } catch (error) {
    log.debug('Error getting push token:', { error });
    return null;
  }
}

// -----------------------------------------------------------------------------
// Register Device with Backend
// -----------------------------------------------------------------------------

/**
 * Register device token with our backend.
 * Call this after successful login.
 * @param authToken - JWT auth token (passed from auth.ts to avoid circular dependency)
 */
export async function registerDeviceToken(authToken: string): Promise<boolean> {
  if (!authToken) {
    log.debug('Cannot register device - no auth token provided');
    return false;
  }

  // Get push token (requests permission if needed)
  const pushToken = await registerForPushNotifications();
  if (!pushToken) {
    log.debug('Cannot register device - no push token');
    return false;
  }

  // Register with backend
  const platform = Platform.OS as 'ios' | 'android';
  log.info('Registering device with backend', { platform });

  const result = await registerDevice(authToken, pushToken, platform);

  if (result.success) {
    log.debug('Device registered successfully');
    return true;
  } else {
    log.debug('Device registration failed:', { error: result.error });
    return false;
  }
}

/**
 * Best-effort wrapper around `registerDeviceToken`. Skips silently when the
 * push_notifications feature flag is off, and swallows any error so a
 * registration failure can never block login or app startup. Use this from
 * any auth-related code path that needs to (re-)register the current device.
 */
export function ensurePushTokenRegistered(authToken: string | null | undefined): void {
  if (!authToken) return;
  if (!getFeatureFlag('push_notifications')) return;
  registerDeviceToken(authToken).catch((e) => log.warn('Push token registration failed:', { e }));
}

// -----------------------------------------------------------------------------
// Unregister Device from Backend
// -----------------------------------------------------------------------------

/**
 * Unregister device token from our backend.
 * Call this before logout.
 * @param authToken - JWT auth token (passed from auth.ts to avoid circular dependency)
 */
export async function unregisterDeviceToken(authToken: string): Promise<void> {
  if (!storedPushToken) {
    log.debug('No stored push token to unregister');
    return;
  }

  if (!authToken) {
    log.debug('Cannot unregister device - no auth token provided');
    storedPushToken = null;
    return;
  }

  log.debug('Unregistering device from backend...');

  try {
    const result = await unregisterDevice(authToken, storedPushToken);
    if (result.success) {
      log.debug('Device unregistered successfully');
    } else {
      log.debug('Device unregistration failed:', { error: result.error });
    }
  } catch (error) {
    log.debug('Error unregistering device:', { error });
  }

  storedPushToken = null;
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Check if push notifications are available
 */
export function isPushAvailable(): boolean {
  return Device.isDevice;
}

export type PushPermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * Get the OS-level push notification permission status.
 * Returns 'granted', 'denied', or 'undetermined' (never asked).
 */
export async function getPushPermissionStatus(): Promise<PushPermissionStatus> {
  if (!Device.isDevice) return 'denied';
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') return 'granted';
    if (status === 'denied') return 'denied';
    return 'undetermined';
  } catch {
    return 'denied';
  }
}

// -----------------------------------------------------------------------------
// Badge Count
// -----------------------------------------------------------------------------

/**
 * Set OS app icon badge to the given count.
 * Callers are responsible for fetching the count (e.g. via notificationsApi.getUnreadCount()).
 */
export async function syncBadgeCount(count: number): Promise<void> {
  if (count === lastBadgeCount) return;
  lastBadgeCount = count;
  try {
    await Notifications.setBadgeCountAsync(count);
    log.debug('Badge synced to', { count });
  } catch (error) {
    log.debug('Badge sync failed:', { error });
  }
}

/**
 * Clear OS app icon badge. Call on logout.
 */
export async function clearBadgeCount(): Promise<void> {
  lastBadgeCount = null;
  try {
    await Notifications.setBadgeCountAsync(0);
    log.debug('Badge cleared');
  } catch (error) {
    log.debug('Badge clear failed:', { error });
  }
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const pushService = {
  registerForPushNotifications,
  registerDeviceToken,
  unregisterDeviceToken,
  isPushAvailable,
  getPushPermissionStatus,
  syncBadgeCount,
  clearBadgeCount,
};

export default pushService;
