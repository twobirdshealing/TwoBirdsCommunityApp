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

// -----------------------------------------------------------------------------
// Debug
// -----------------------------------------------------------------------------

const DEBUG = __DEV__;
function log(...args: any[]) {
  if (DEBUG) console.log('[Push]', ...args);
}

// -----------------------------------------------------------------------------
// Module State
// -----------------------------------------------------------------------------

let storedPushToken: string | null = null;

// -----------------------------------------------------------------------------
// Configure Notifications
// -----------------------------------------------------------------------------

// Set notification handler (how to show notifications when app is in foreground)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
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
    log('Push notifications require a physical device');
    return null;
  }

  // Check existing permission status
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    log('Requesting push notification permission...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    log('Push notification permission denied');
    return null;
  }

  log('Push notification permission granted');

  // Get Expo push token
  try {
    const projectId = getProjectId();
    log('Project ID:', projectId);

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    storedPushToken = tokenData.data;
    log('Got push token:', storedPushToken.substring(0, 30) + '...');

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
    log('Error getting push token:', error);
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
    log('Cannot register device - no auth token provided');
    return false;
  }

  // Get push token (requests permission if needed)
  const pushToken = await registerForPushNotifications();
  if (!pushToken) {
    log('Cannot register device - no push token');
    return false;
  }

  // Register with backend
  const platform = Platform.OS as 'ios' | 'android';
  log(`Registering device with backend (${platform})...`);

  const result = await registerDevice(authToken, pushToken, platform);

  if (result.success) {
    log('Device registered successfully');
    return true;
  } else {
    log('Device registration failed:', result.error);
    return false;
  }
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
    log('No stored push token to unregister');
    return;
  }

  if (!authToken) {
    log('Cannot unregister device - no auth token provided');
    storedPushToken = null;
    return;
  }

  log('Unregistering device from backend...');

  try {
    const result = await unregisterDevice(authToken, storedPushToken);
    if (result.success) {
      log('Device unregistered successfully');
    } else {
      log('Device unregistration failed:', result.error);
    }
  } catch (error) {
    log('Error unregistering device:', error);
  }

  storedPushToken = null;
}

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Get the stored push token (if any)
 */
export function getStoredPushToken(): string | null {
  return storedPushToken;
}

/**
 * Check if push notifications are available
 */
export function isPushAvailable(): boolean {
  return Device.isDevice;
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const pushService = {
  registerForPushNotifications,
  registerDeviceToken,
  unregisterDeviceToken,
  getStoredPushToken,
  isPushAvailable,
};

export default pushService;
