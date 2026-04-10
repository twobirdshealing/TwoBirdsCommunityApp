// =============================================================================
// AUTH SERVICE - Self-contained JWT Authentication
// =============================================================================
// Uses expo-secure-store to securely store JWT tokens on device.
// Access token (1 day) for API calls, refresh token (6 months) for re-auth.
// No stored credentials — refresh token is the only re-auth mechanism.
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import { getFeatureFlag } from '@/utils/featureFlags';
import type { AuthUser } from '@/types/user';
import * as SecureStore from 'expo-secure-store';
import { registerDeviceToken, unregisterDeviceToken, clearBadgeCount } from './push';
import { createLogger } from '@/utils/logger';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// Auth endpoints (self-contained in tbc-community-app plugin)
const AUTH_LOGIN_URL = `${TBC_CA_URL}/auth/login`;
const AUTH_REFRESH_URL = `${TBC_CA_URL}/auth/refresh`;
const AUTH_LOGOUT_URL = `${TBC_CA_URL}/auth/logout`;

// SecureStore keys
const AUTH_KEY = 'tbc_auth_jwt';
const REFRESH_KEY = 'tbc_auth_refresh';
const USER_KEY = 'tbc_user_info';

const log = createLogger('Auth');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface LoginResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

// Login endpoint response
interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    username: string;
    display_name: string;
    first_name?: string;
    last_name?: string;
    email: string;
    avatar: string;
    is_verified?: number;
    status?: string;
  };
}

// Refresh endpoint response
interface RefreshResponse {
  access_token: string;
}

// Error response
interface AuthErrorResponse {
  code: string;
  message: string;
}

// -----------------------------------------------------------------------------
// Error Message Helper
// -----------------------------------------------------------------------------

function getReadableErrorMessage(status: number, data: any): string {
  if (data?.code) {
    switch (data.code) {
      case 'tbc_auth_invalid_credentials':
        return 'Invalid username or password. Please try again.';

      case 'tbc_auth_missing_fields':
        return 'Please enter your username and password.';

      case 'tbc_auth_expired_token':
        return 'Session expired. Please log in again.';

      case 'tbc_auth_revoked_session':
        return 'Session has been revoked. Please log in again.';

      default:
        break;
    }
  }

  // Handle HTTP status codes
  switch (status) {
    case 401:
      return 'Invalid username or password. Please try again.';

    case 403:
      return 'Access denied. Your account may be restricted.';

    case 404:
      return 'Login service unavailable. Please try again later or contact support.';

    case 500:
    case 502:
    case 503:
      return 'Server error. Please try again later.';

    case 0:
      return 'Network error. Please check your internet connection.';

    default:
      return data?.message || 'Login failed. Please try again.';
  }
}

// -----------------------------------------------------------------------------
// Auth Functions
// -----------------------------------------------------------------------------

/**
 * Login with username/email and password.
 * Returns access + refresh tokens + user profile in a single call.
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  log.debug('Login attempt for:', { username });

  try {
    const response = await fetch(AUTH_LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    log.info('Login response', { status: response.status, hasToken: !!data.access_token });

    if (!response.ok || !data.access_token) {
      log.debug('Login failed:', { data });
      return {
        success: false,
        error: getReadableErrorMessage(response.status, data),
      };
    }

    const loginData = data as LoginResponse;

    // Store tokens
    await SecureStore.setItemAsync(AUTH_KEY, loginData.access_token);
    await SecureStore.setItemAsync(REFRESH_KEY, loginData.refresh_token);
    log.debug('Tokens stored');

    // Build user from login response (no extra profile fetch needed)
    const user: AuthUser = {
      id: loginData.user.id,
      username: loginData.user.username,
      displayName: loginData.user.display_name,
      firstName: loginData.user.first_name || undefined,
      lastName: loginData.user.last_name || undefined,
      email: loginData.user.email,
      avatar: loginData.user.avatar || undefined,
      isVerified: loginData.user.is_verified,
      status: loginData.user.status,
    };

    // Store user info
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    log.info('User info stored', { username: user.username, id: user.id });

    // Register device for push notifications (non-blocking)
    if (getFeatureFlag('push_notifications')) {
      registerDeviceToken(loginData.access_token).catch(err => {
        log.debug('Failed to register push token:', { err });
      });
    }

    return { success: true, user };

  } catch (error) {
    log.debug('Login error:', { error });

    if (error instanceof TypeError && error.message.includes('Network')) {
      return {
        success: false,
        error: 'Network error. Please check your internet connection.',
      };
    }

    return {
      success: false,
      error: 'Unable to connect. Please check your internet connection and try again.',
    };
  }
}

/**
 * Logout - revoke server session and clear stored tokens
 */
export async function logout(): Promise<void> {
  log.debug('Logging out...');

  const token = await getAuthToken();
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);

  // Unregister device from push notifications
  if (getFeatureFlag('push_notifications') && token) {
    await unregisterDeviceToken(token).catch((e) => {
      log.warn('Failed to unregister device token:', { e });
    });
  }

  // Clear app icon badge
  await clearBadgeCount();

  // Server-side logout (revoke session) — non-blocking, best effort
  if (token) {
    fetch(AUTH_LOGOUT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }).catch((e) => log.warn('Server logout failed (non-blocking):', { e }));
  }

  await clearAuth();
}

/**
 * Check if user has stored auth
 */
export async function hasStoredAuth(): Promise<boolean> {
  try {
    const auth = await SecureStore.getItemAsync(AUTH_KEY);
    return auth !== null;
  } catch {
    return false;
  }
}

/**
 * Get the stored JWT token for API calls
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(AUTH_KEY);
    if (token) {
      log.debug('Retrieved JWT token');
    }
    return token;
  } catch (error) {
    log.debug('Error getting token:', { error });
    return null;
  }
}


/**
 * Get the stored user data
 */
export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const userJson = await SecureStore.getItemAsync(USER_KEY);
    if (userJson) {
      const user = JSON.parse(userJson);
      log.debug('Retrieved user:', { username: user.username });
      return user;
    }
    return null;
  } catch (error) {
    log.debug('Error getting user:', { error });
    return null;
  }
}

/**
 * Clear all auth data
 */
// Auth state change callback (set by AuthContext)
let onAuthCleared: (() => void) | null = null;

export function setOnAuthCleared(callback: (() => void) | null): void {
  onAuthCleared = callback;
}

export async function clearAuth(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    log.debug('Auth cleared');

    if (onAuthCleared) {
      onAuthCleared();
    }
  } catch (error) {
    log.debug('Error clearing auth:', { error });
  }
}

// -----------------------------------------------------------------------------
// Silent Refresh - Exchange refresh token for new access token
// -----------------------------------------------------------------------------

let refreshInProgress: Promise<boolean> | null = null;

export async function silentRefresh(): Promise<boolean> {
  // If a refresh is already in progress, wait for it
  if (refreshInProgress) {
    log.debug('Silent refresh already in progress, waiting...');
    return refreshInProgress;
  }

  refreshInProgress = (async () => {
    try {
      log.debug('Attempting token refresh...');

      const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
      if (!refreshToken) {
        log.debug('No refresh token available');
        await clearAuth();
        return false;
      }

      // Direct fetch to refresh endpoint (NOT using our API client to avoid loops)
      const response = await fetch(AUTH_REFRESH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        log.warn('Token refresh failed', { reason: data?.code ?? response.status });
        // Refresh token expired or revoked — clear everything
        await clearAuth();
        return false;
      }

      const data: RefreshResponse = await response.json();

      // Store the new access token
      await SecureStore.setItemAsync(AUTH_KEY, data.access_token);
      log.debug('Token refresh successful, new access token stored');
      return true;
    } catch (error) {
      log.debug('Token refresh error:', { error });
      return false;
    } finally {
      refreshInProgress = null;
    }
  })();

  return refreshInProgress;
}

/**
 * Store auth data directly (for registration auto-login where we already have tokens).
 * Stores access token, refresh token, and user info in SecureStore.
 */
export async function storeAuthDirect(
  accessToken: string,
  refreshToken: string,
  user: AuthUser,
): Promise<void> {
  await SecureStore.setItemAsync(AUTH_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  log.debug('Auth stored directly (registration)');
}

/**
 * Update stored user data (e.g., after profile update)
 */
export async function updateStoredUser(updates: Partial<AuthUser>): Promise<void> {
  try {
    const current = await getStoredUser();
    if (current) {
      const updated = { ...current, ...updates };
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updated));
      log.debug('User info updated');
    }
  } catch (error) {
    log.debug('Error updating user:', { error });
  }
}
