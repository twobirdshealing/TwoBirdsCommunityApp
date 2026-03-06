// =============================================================================
// PUSH API SERVICE - API calls for TBC Community App push notifications
// =============================================================================
// Endpoints are on the TBC-CA plugin, NOT Fluent Community API
// NOTE: This file does NOT import from auth.ts to avoid circular dependencies.
//       Auth token is passed as a parameter from the caller (push.ts).
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import { createLogger } from '@/utils/logger';

const log = createLogger('PushAPI');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PushPreference {
  id: string;
  label: string;
  description: string;
  category: string;
  enabled: boolean;
}

export interface PushSettingsResponse {
  success: boolean;
  preferences: Record<string, PushPreference[]>;
  device_count: number;
}

// -----------------------------------------------------------------------------
// Helper: Make authenticated request to TBC-CA endpoints
// -----------------------------------------------------------------------------

async function tbcRequest<T>(
  endpoint: string,
  authToken: string,
  options: RequestInit = {}
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const response = await fetch(`${TBC_CA_URL}${endpoint}`, {
      ...options,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.message || `Request failed with status ${response.status}`,
      };
    }

    return { success: true, data };
  } catch (error) {
    log.error(error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network request failed',
    };
  }
}

// -----------------------------------------------------------------------------
// API Functions
// -----------------------------------------------------------------------------

/**
 * GET /push/settings - Get user's notification preferences
 * @param authToken - JWT auth token
 */
export async function getPushSettings(authToken: string) {
  return tbcRequest<PushSettingsResponse>('/push/settings', authToken);
}

/**
 * POST /push/settings - Update user notification preferences
 * @param authToken - JWT auth token
 * @param preferences - Map of preference ID to enabled state
 */
export async function updatePushSettings(authToken: string, preferences: Record<string, boolean>) {
  return tbcRequest<{ success: boolean; preferences: Record<string, PushPreference[]> }>(
    '/push/settings',
    authToken,
    {
      method: 'POST',
      body: JSON.stringify({ preferences }),
    }
  );
}

/**
 * POST /push/device - Register device token
 * @param authToken - JWT auth token
 * @param pushToken - Expo push token
 * @param platform - 'ios' or 'android'
 */
export async function registerDevice(authToken: string, pushToken: string, platform: 'ios' | 'android') {
  return tbcRequest<{ success: boolean; message: string }>(
    '/push/device',
    authToken,
    {
      method: 'POST',
      body: JSON.stringify({ token: pushToken, platform }),
    }
  );
}

/**
 * DELETE /push/device - Unregister device token
 * @param authToken - JWT auth token
 * @param pushToken - Expo push token to unregister
 */
export async function unregisterDevice(authToken: string, pushToken?: string) {
  const url = pushToken ? `/push/device?token=${encodeURIComponent(pushToken)}` : '/push/device';
  return tbcRequest<{ success: boolean; message: string }>(url, authToken, {
    method: 'DELETE',
  });
}

// -----------------------------------------------------------------------------
// Export as object for consistency with other API services
// -----------------------------------------------------------------------------

export const pushApi = {
  getPushSettings,
  updatePushSettings,
  registerDevice,
  unregisterDevice,
};

export default pushApi;
