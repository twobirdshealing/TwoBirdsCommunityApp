// =============================================================================
// PUSH API SERVICE - API calls for TBC Community App push notifications
// =============================================================================
// Endpoints live on the TBC-CA plugin (not Fluent Community). All requests go
// through the shared API client, which injects the JWT, enforces the request
// timeout, and safely handles non-JSON responses (e.g. HTML error pages).
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import { request } from './client';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface PushPreference {
  id: string;
  label: string;
  description: string;
  category: string;
  enabled: boolean;
  // Server-driven UI metadata
  email_key?: string;
  group?: string;
  group_label?: string;
  group_description?: string;
  push_label?: string;
  note?: string;
}

export interface PushSettingsResponse {
  success: boolean;
  preferences: Record<string, PushPreference[]>;
  device_count: number;
}

// -----------------------------------------------------------------------------
// API Functions
// -----------------------------------------------------------------------------

export async function getPushSettings() {
  return request<PushSettingsResponse>('/push/settings', {
    method: 'GET',
    baseUrl: TBC_CA_URL,
  });
}

export async function updatePushSettings(preferences: Record<string, boolean>) {
  return request<{ success: boolean; preferences: Record<string, PushPreference[]> }>(
    '/push/settings',
    {
      method: 'POST',
      body: { preferences },
      baseUrl: TBC_CA_URL,
    }
  );
}

export async function registerDevice(pushToken: string, platform: 'ios' | 'android') {
  return request<{ success: boolean; message: string }>('/push/device', {
    method: 'POST',
    body: { token: pushToken, platform },
    baseUrl: TBC_CA_URL,
  });
}

export async function unregisterDevice(pushToken?: string) {
  return request<{ success: boolean; message: string }>('/push/device', {
    method: 'DELETE',
    params: pushToken ? { token: pushToken } : undefined,
    baseUrl: TBC_CA_URL,
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
