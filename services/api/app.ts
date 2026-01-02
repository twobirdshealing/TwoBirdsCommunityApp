// =============================================================================
// APP API SERVICE - TBC Community App specific endpoints
// =============================================================================
// Web session creation for WebView authentication
// Uses JWT Bearer token authentication
// =============================================================================

import { SITE_URL } from '@/constants/config';
import { getAuthToken } from '@/services/auth';

const APP_API_URL = `${SITE_URL}/wp-json/tbc-ca/v1`;

// -----------------------------------------------------------------------------
// Debug
// -----------------------------------------------------------------------------

const DEBUG = __DEV__;
function log(...args: any[]) {
  if (DEBUG) console.log('[AppAPI]', ...args);
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface WebSessionResponse {
  success: boolean;
  url: string;
  expires_in: number;
}

// -----------------------------------------------------------------------------
// Create Web Session
// -----------------------------------------------------------------------------

/**
 * Create a one-time login URL for WebView
 * The URL will automatically log the user in when opened
 *
 * @param redirectUrl - Where to redirect after login
 */
export async function createWebSession(redirectUrl: string): Promise<WebSessionResponse> {
  const url = `${APP_API_URL}/create-web-session`;
  log('POST', url);
  log('Redirect URL:', redirectUrl);

  const authToken = await getAuthToken();

  if (!authToken) {
    log('ERROR: No auth token');
    throw new Error('Not authenticated');
  }

  log('Auth token length:', authToken.length);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ redirect_url: redirectUrl }),
    });

    log('Response status:', response.status);

    const data = await response.json();
    log('Response:', JSON.stringify(data).substring(0, 200));

    if (!response.ok) {
      throw new Error(data.message || `Request failed: ${response.status}`);
    }

    return data;
  } catch (error) {
    log('Error:', error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

export const appApi = {
  createWebSession,
};

export default appApi;
