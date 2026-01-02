// =============================================================================
// AUTH SERVICE - JWT Authentication
// =============================================================================
// Uses expo-secure-store to securely store JWT token on device.
// Uses WordPress JWT Authentication plugin for login.
// =============================================================================

import { SITE_URL } from '@/constants/config';
import * as SecureStore from 'expo-secure-store';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// JWT Auth endpoint (provided by JWT Authentication for WP REST API plugin)
const JWT_ENDPOINT = `${SITE_URL}/wp-json/jwt-auth/v1/token`;

// SecureStore keys
const AUTH_KEY = 'tbc_auth_jwt';
const USER_KEY = 'tbc_user_info';

// Debug mode
const DEBUG = __DEV__;

function log(...args: any[]) {
  if (DEBUG) {
    console.log('[Auth]', ...args);
  }
}

// -----------------------------------------------------------------------------
// Types - MUST match AuthContext.tsx User interface
// -----------------------------------------------------------------------------

interface User {
  id?: number;           // May not have ID from JWT, will get from profile API
  username: string;
  displayName: string;   // camelCase to match AuthContext
  email: string;
  avatar?: string;       // Will be fetched from Fluent profile API
}

interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

// JWT Auth plugin response
interface JWTResponse {
  token: string;
  user_email: string;
  user_nicename: string;      // This is the username
  user_display_name: string;
}

// -----------------------------------------------------------------------------
// Error Message Helper
// -----------------------------------------------------------------------------

function getReadableErrorMessage(status: number, data: any): string {
  // Handle JWT Auth specific error codes
  if (data?.code) {
    switch (data.code) {
      case '[jwt_auth] invalid_username':
      case 'invalid_username':
        return 'Username not found. Please check your username and try again.';

      case '[jwt_auth] incorrect_password':
      case 'incorrect_password':
        return 'Incorrect password. Please try again.';

      case '[jwt_auth] invalid_email':
      case 'invalid_email':
        return 'Invalid email address. Please check and try again.';

      case '[jwt_auth] empty_username':
      case 'empty_username':
        return 'Please enter your username.';

      case '[jwt_auth] empty_password':
      case 'empty_password':
        return 'Please enter your password.';

      case 'jwt_auth_failed':
        return 'Authentication failed. Please try again.';

      case 'jwt_auth_invalid_token':
        return 'Session expired. Please log in again.';

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
 * Login with username/email and WordPress password
 * Uses JWT Authentication plugin
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  log('Login attempt for:', username);

  try {
    // POST to JWT auth endpoint
    const response = await fetch(JWT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    const data = await response.json();
    log('Login response:', response.status, data.token ? 'TOKEN_RECEIVED' : 'FAILED');

    if (!response.ok || !data.token) {
      log('Login failed:', data);

      // Get user-friendly error message
      const errorMessage = getReadableErrorMessage(response.status, data);

      return {
        success: false,
        error: errorMessage,
      };
    }

    const jwtData = data as JWTResponse;

    // Store the JWT token
    await SecureStore.setItemAsync(AUTH_KEY, jwtData.token);
    log('JWT token stored');

    // Map JWT response to our User type
    // Note: JWT gives us username (user_nicename), email, and display_name
    // Avatar and full profile will be fetched from Fluent's profile API
    const user: User = {
      username: jwtData.user_nicename,
      displayName: jwtData.user_display_name,
      email: jwtData.user_email,
    };

    // Store user info
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    log('User info stored:', user.username);

    return { success: true, user };

  } catch (error) {
    log('Login error:', error);

    // Check for network errors
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
 * Logout - clear stored credentials
 */
export async function logout(): Promise<void> {
  log('Logging out...');
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
      log('Retrieved JWT token');
    }
    return token;
  } catch (error) {
    log('Error getting token:', error);
    return null;
  }
}

// Keep old function name as alias for backwards compatibility during migration
export const getBasicAuth = getAuthToken;

/**
 * Get the stored user data
 */
export async function getStoredUser(): Promise<User | null> {
  try {
    const userJson = await SecureStore.getItemAsync(USER_KEY);
    if (userJson) {
      const user = JSON.parse(userJson);
      log('Retrieved user:', user.username);
      return user;
    }
    return null;
  } catch (error) {
    log('Error getting user:', error);
    return null;
  }
}

/**
 * Clear all auth data
 */
export async function clearAuth(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    log('Auth cleared');
  } catch (error) {
    log('Error clearing auth:', error);
  }
}

/**
 * Update stored user data (e.g., after profile update)
 */
export async function updateStoredUser(updates: Partial<User>): Promise<void> {
  try {
    const current = await getStoredUser();
    if (current) {
      const updated = { ...current, ...updates };
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(updated));
      log('User info updated');
    }
  } catch (error) {
    log('Error updating user:', error);
  }
}
