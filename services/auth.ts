// =============================================================================
// AUTH SERVICE - Login, logout, and token management
// =============================================================================
// Uses expo-secure-store to securely store credentials on device.
// Never stores passwords in plain AsyncStorage!
// =============================================================================

import { SITE_URL } from '@/constants/config';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const AUTH_ENDPOINT = `${SITE_URL}/wp-json/tbc-ca/v1`;

// SecureStore keys (prefixed for clarity)
const STORAGE_KEYS = {
  USERNAME: 'tbc_auth_username',
  BASIC_AUTH: 'tbc_auth_basic',
  APP_PASSWORD_UUID: 'tbc_auth_uuid',
  USER_DATA: 'tbc_auth_user',
};

// Debug mode - set to false for production
const DEBUG = true;

function log(...args: any[]) {
  if (DEBUG) {
    console.log('[Auth]', ...args);
  }
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
  avatar: string;
  registered: string;
  roles: string[];
  fluent_profile?: any;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user: AuthUser;
  auth: {
    username: string;
    app_password: string;
    app_password_uuid: string;
    basic_auth: string;
  };
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  basicAuth: string | null;
}

// -----------------------------------------------------------------------------
// Secure Storage Helpers
// -----------------------------------------------------------------------------

async function secureSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
    log(`Stored: ${key} (${value.length} chars)`);
  } catch (error) {
    log(`Error storing ${key}:`, error);
    throw error;
  }
}

async function secureGet(key: string): Promise<string | null> {
  try {
    let value: string | null;
    if (Platform.OS === 'web') {
      value = localStorage.getItem(key);
    } else {
      value = await SecureStore.getItemAsync(key);
    }
    log(`Retrieved: ${key} = ${value ? `(${value.length} chars)` : 'null'}`);
    return value;
  } catch (error) {
    log(`Error retrieving ${key}:`, error);
    return null;
  }
}

async function secureDelete(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
    log(`Deleted: ${key}`);
  } catch (error) {
    log(`Error deleting ${key}:`, error);
  }
}

// -----------------------------------------------------------------------------
// Auth Functions
// -----------------------------------------------------------------------------

/**
 * Login with username/email and password
 */
export async function login(
  username: string,
  password: string,
  deviceName?: string
): Promise<{ success: true; user: AuthUser } | { success: false; error: string }> {
  log('Login attempt for:', username);
  
  try {
    const response = await fetch(`${AUTH_ENDPOINT}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        device_name: deviceName || `Two Birds App - ${Platform.OS}`,
      }),
    });

    const data = await response.json();
    log('Login response:', response.status, data.success ? 'SUCCESS' : 'FAILED');

    if (!response.ok || !data.success) {
      return {
        success: false,
        error: data.message || 'Login failed. Please try again.',
      };
    }

    const loginData = data as LoginResponse;

    // Store credentials securely
    log('Storing credentials...');
    await secureSet(STORAGE_KEYS.USERNAME, loginData.auth.username);
    await secureSet(STORAGE_KEYS.BASIC_AUTH, loginData.auth.basic_auth);
    await secureSet(STORAGE_KEYS.APP_PASSWORD_UUID, loginData.auth.app_password_uuid);
    await secureSet(STORAGE_KEYS.USER_DATA, JSON.stringify(loginData.user));
    log('Credentials stored successfully');

    return {
      success: true,
      user: loginData.user,
    };
  } catch (error) {
    log('Login error:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
}

/**
 * Logout - revoke app password and clear stored credentials
 */
export async function logout(): Promise<void> {
  log('Logout initiated');
  
  try {
    const basicAuth = await secureGet(STORAGE_KEYS.BASIC_AUTH);
    const uuid = await secureGet(STORAGE_KEYS.APP_PASSWORD_UUID);

    // Try to revoke the app password on the server
    if (basicAuth && uuid) {
      log('Revoking app password on server...');
      await fetch(`${AUTH_ENDPOINT}/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ app_password_uuid: uuid }),
      }).catch((err) => {
        log('Server logout failed (will clear local anyway):', err);
      });
    }
  } finally {
    // Always clear local storage
    log('Clearing local storage...');
    await secureDelete(STORAGE_KEYS.USERNAME);
    await secureDelete(STORAGE_KEYS.BASIC_AUTH);
    await secureDelete(STORAGE_KEYS.APP_PASSWORD_UUID);
    await secureDelete(STORAGE_KEYS.USER_DATA);
    log('Logout complete');
  }
}

/**
 * Check if user is logged in and load stored credentials
 */
export async function getStoredAuth(): Promise<{
  isAuthenticated: boolean;
  user: AuthUser | null;
  basicAuth: string | null;
}> {
  log('Loading stored auth...');
  
  try {
    const basicAuth = await secureGet(STORAGE_KEYS.BASIC_AUTH);
    const userDataStr = await secureGet(STORAGE_KEYS.USER_DATA);

    if (!basicAuth || !userDataStr) {
      log('No stored auth found');
      return { isAuthenticated: false, user: null, basicAuth: null };
    }

    const user = JSON.parse(userDataStr) as AuthUser;
    log('Stored auth found for user:', user.username);
    return { isAuthenticated: true, user, basicAuth };
  } catch (error) {
    log('Error loading stored auth:', error);
    return { isAuthenticated: false, user: null, basicAuth: null };
  }
}

/**
 * Validate that the stored token is still valid
 */
export async function validateToken(): Promise<boolean> {
  log('Validating token...');
  
  try {
    const basicAuth = await secureGet(STORAGE_KEYS.BASIC_AUTH);
    
    if (!basicAuth) {
      log('No token to validate');
      return false;
    }

    const response = await fetch(`${AUTH_ENDPOINT}/validate`, {
      headers: {
        'Authorization': `Basic ${basicAuth}`,
      },
    });

    const data = await response.json();
    const isValid = data.valid === true;
    log('Token validation result:', isValid);
    return isValid;
  } catch (error) {
    log('Token validation error:', error);
    return false;
  }
}

/**
 * Get the stored Basic Auth header value for API calls
 */
export async function getBasicAuth(): Promise<string | null> {
  return await secureGet(STORAGE_KEYS.BASIC_AUTH);
}

/**
 * Get the stored user data
 */
export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const userDataStr = await secureGet(STORAGE_KEYS.USER_DATA);
    if (!userDataStr) return null;
    return JSON.parse(userDataStr) as AuthUser;
  } catch {
    return null;
  }
}

/**
 * Update stored user data (e.g., after profile update)
 */
export async function updateStoredUser(user: AuthUser): Promise<void> {
  await secureSet(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
}