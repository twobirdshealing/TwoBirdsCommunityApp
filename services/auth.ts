// =============================================================================
// AUTH SERVICE - Authentication logic
// =============================================================================

import * as SecureStore from 'expo-secure-store';
import { API_URL } from '@/constants/config';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const AUTH_KEY = 'tbc_auth_basic';
const USER_KEY = 'tbc_user_info';

const DEBUG = __DEV__;

function log(...args: any[]) {
  if (DEBUG) console.log('[Auth]', ...args);
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
}

interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

// -----------------------------------------------------------------------------
// Login
// -----------------------------------------------------------------------------

export async function login(username: string, password: string): Promise<LoginResult> {
  log('Login attempt for:', username);
  
  try {
    // Create Basic Auth token
    const credentials = `${username}:${password}`;
    const base64Credentials = btoa(credentials);
    
    // Validate credentials by calling an API endpoint
    const response = await fetch(`${API_URL}/profile/${username}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${base64Credentials}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      log('Login failed:', response.status, errorData);
      
      if (response.status === 401 || response.status === 403) {
        return { success: false, error: 'Invalid username or password' };
      }
      
      return { success: false, error: errorData.message || 'Login failed' };
    }
    
    const data = await response.json();
    log('Login successful, profile:', data.profile?.username);
    
    // Store credentials
    await SecureStore.setItemAsync(AUTH_KEY, base64Credentials);
    log('Credentials stored');
    
    // Extract and store user info
    const user: User = {
      id: data.profile?.user_id || 0,
      username: data.profile?.username || username,
      displayName: data.profile?.display_name || username,
      email: data.profile?.email || '',
      avatar: data.profile?.avatar || undefined,
    };
    
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    log('User info stored:', user.username);
    
    return { success: true, user };
    
  } catch (error) {
    log('Login error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

// -----------------------------------------------------------------------------
// Logout
// -----------------------------------------------------------------------------

export async function logout(): Promise<void> {
  log('Logging out...');
  await clearAuth();
}

// -----------------------------------------------------------------------------
// Storage Functions
// -----------------------------------------------------------------------------

export async function getBasicAuth(): Promise<string | null> {
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

export async function hasStoredAuth(): Promise<boolean> {
  const auth = await SecureStore.getItemAsync(AUTH_KEY);
  return auth !== null;
}

export async function clearAuth(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(AUTH_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    log('Auth cleared');
  } catch (error) {
    log('Error clearing auth:', error);
  }
}

// -----------------------------------------------------------------------------
// Update stored user (e.g., after profile edit)
// -----------------------------------------------------------------------------

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
