// =============================================================================
// AUTH SERVICE - Login, logout, and token management
// =============================================================================
// Uses expo-secure-store to securely store credentials on device.
// Uses our custom WordPress plugin (tbc-ca) for authentication.
// IMPROVED: Better error messages for common issues
// =============================================================================

import { DEBUG_AUTH, SITE_URL } from '@/constants/config';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

// Use our custom login plugin endpoint
const AUTH_ENDPOINT = `${SITE_URL}/wp-json/tbc-ca/v1`;

// SecureStore keys
const AUTH_KEY = 'tbc_auth_basic';
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
  id: number;
  username: string;
  displayName: string;  // camelCase to match AuthContext
  email: string;
  avatar?: string;
}

interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

// API response type (from our WordPress plugin)
interface LoginResponse {
  success: boolean;
  message: string;
  user: {
    id: number;
    username: string;
    email: string;
    display_name: string;  // snake_case from API
    first_name: string;
    last_name: string;
    avatar: string;
    registered: string;
    roles: string[];
  };
  auth: {
    username: string;
    app_password: string;
    app_password_uuid: string;
    basic_auth: string;
  };
}

// -----------------------------------------------------------------------------
// Error Message Helper
// -----------------------------------------------------------------------------

function getReadableErrorMessage(status: number, data: any): string {
  // Handle specific error codes
  if (data?.code) {
    switch (data.code) {
      case 'rest_no_route':
        return 'Unable to connect to login service. The TBC Community App plugin may be deactivated on the server. Please contact support.';
      
      case 'invalid_username':
        return 'Username not found. Please check your username and try again.';
      
      case 'incorrect_password':
        return 'Incorrect password. Please try again.';
      
      case 'invalid_email':
        return 'Invalid email address. Please check and try again.';
      
      case 'empty_username':
        return 'Please enter your username.';
      
      case 'empty_password':
        return 'Please enter your password.';
      
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
 * Our plugin creates an Application Password and returns it
 */
export async function login(username: string, password: string): Promise<LoginResult> {
  log('Login attempt for:', username);
  
  try {
    // POST to our custom login endpoint
    const response = await fetch(`${AUTH_ENDPOINT}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
        device_name: `Two Birds App - ${Platform.OS}`,
      }),
    });

    const data = await response.json();
    log('Login response:', response.status, data.success ? 'SUCCESS' : 'FAILED');

    if (!response.ok || !data.success) {
      log('Login failed:', data);
      
      // Get user-friendly error message
      const errorMessage = getReadableErrorMessage(response.status, data);
      
      return {
        success: false,
        error: errorMessage,
      };
    }

    const loginData = data as LoginResponse;

    // Store the basic_auth token (pre-encoded by the server!)
    await SecureStore.setItemAsync(AUTH_KEY, loginData.auth.basic_auth);
    log('Auth token stored');

    // Map API response to our User type (display_name -> displayName)
    const user: User = {
      id: loginData.user.id,
      username: loginData.user.username,
      displayName: loginData.user.display_name,  // Convert snake_case to camelCase
      email: loginData.user.email,
      avatar: loginData.user.avatar || undefined,
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
 * Returns true if hardcoded auth is enabled OR SecureStore has auth
 */
export async function hasStoredAuth(): Promise<boolean> {
  // If using hardcoded auth, always return true
  if (DEBUG_AUTH.USE_HARDCODED_AUTH) {
    return true;
  }

  // Normal flow: check SecureStore
  try {
    const auth = await SecureStore.getItemAsync(AUTH_KEY);
    return auth !== null;
  } catch {
    return false;
  }
}

/**
 * Get the stored Basic Auth header value for API calls
 * If DEBUG_AUTH.USE_HARDCODED_AUTH is enabled, returns hardcoded credentials
 */
export async function getBasicAuth(): Promise<string | null> {
  // Check if we should use hardcoded auth for testing/debugging
  if (DEBUG_AUTH.USE_HARDCODED_AUTH) {
    const credentials = `${DEBUG_AUTH.HARDCODED_USERNAME}:${DEBUG_AUTH.HARDCODED_PASSWORD}`;
    const encodedCredentials = btoa(credentials);
    console.warn('[Auth] ⚠️  Using HARDCODED credentials (DEBUG MODE)');
    console.log('[Auth] Hardcoded user:', DEBUG_AUTH.HARDCODED_USERNAME);
    return encodedCredentials;
  }

  // Normal flow: get from SecureStore
  try {
    const auth = await SecureStore.getItemAsync(AUTH_KEY);
    if (auth) {
      log('Retrieved auth token');
    }
    return auth;
  } catch (error) {
    log('Error getting auth:', error);
    return null;
  }
}

/**
 * Get the stored user data
 * Returns mock user data if hardcoded auth is enabled
 */
export async function getStoredUser(): Promise<User | null> {
  // If using hardcoded auth, return mock user
  if (DEBUG_AUTH.USE_HARDCODED_AUTH) {
    const mockUser: User = {
      id: 1,
      username: DEBUG_AUTH.HARDCODED_USERNAME,
      displayName: DEBUG_AUTH.HARDCODED_USERNAME,
      email: `${DEBUG_AUTH.HARDCODED_USERNAME}@test.local`,
    };
    console.log('[Auth] Using hardcoded user:', mockUser.username);
    return mockUser;
  }

  // Normal flow: get from SecureStore
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