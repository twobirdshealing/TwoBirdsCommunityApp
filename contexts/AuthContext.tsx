// =============================================================================
// AUTH CONTEXT - Global authentication state
// =============================================================================

import * as authService from '@/services/auth';
import { profilesApi } from '@/services/api/profiles';
import { clearBadgeCache } from '@/services/api/badges';
import { clearSocialProvidersCache } from '@/services/api/socialProviders';
import { clearReactionConfigCache } from '@/hooks/useReactionConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLogger } from '@/utils/logger';
import type { AuthUser } from '@/types/user';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => Promise<void>;
  registerAndLogin: (accessToken: string, refreshToken: string, userData: AuthUser) => Promise<void>;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const log = createLogger('AuthContext');

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Register callback so API client can notify us when auth is cleared (e.g. silent refresh failed)
  useEffect(() => {
    authService.setOnAuthCleared(() => {
      setUser(null);
      setIsAuthenticated(false);
    });

    return () => {
      authService.setOnAuthCleared(null);
    };
  }, []);

  const checkAuthStatus = async () => {
    try {
      const hasAuth = await authService.hasStoredAuth();
      
      if (hasAuth) {
        // Get stored user info
        const storedUser = await authService.getStoredUser();
        if (storedUser) {
          setUser(storedUser);
          setIsAuthenticated(true);

          // Background refresh: pick up changes made on web (avatar, name, etc.)
          if (storedUser.username) {
            profilesApi.getProfile(storedUser.username).then(res => {
              if (res.success && res.data.profile) {
                const p = res.data.profile;
                const updates: Partial<AuthUser> = {};
                if (p.user_id && p.user_id !== storedUser.id) updates.id = p.user_id;
                if (p.avatar !== (storedUser.avatar || null)) updates.avatar = p.avatar || undefined;
                if (p.display_name && p.display_name !== storedUser.displayName) updates.displayName = p.display_name;
                if (Object.keys(updates).length > 0) {
                  authService.updateStoredUser(updates);
                  setUser(prev => prev ? { ...prev, ...updates } : prev);
                }
              }
            }).catch(() => { /* silent — cached data still works */ });
          }
        } else {
          // Has auth but no user info - clear it
          await authService.clearAuth();
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      if (__DEV__) console.error('[Auth] Check status error:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = useCallback(async (username: string, password: string) => {
    try {
      const result = await authService.login(username, password);
      
      if (result.success && result.user) {
        setUser(result.user);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Login failed' };
      }
    } catch (error) {
      if (__DEV__) console.error('[Auth] Login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();

      // Clear in-memory caches
      clearBadgeCache();
      clearSocialProvidersCache();
      clearReactionConfigCache();

      // Clear user-specific AsyncStorage caches (keep account-agnostic preferences)
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const userCacheKeys = allKeys.filter(k =>
          k.startsWith('tbc_activity_') ||
          k.startsWith('tbc_bookmarks') ||
          k.startsWith('tbc_feed_') ||
          k.startsWith('tbc_widget_events') ||
          k.startsWith('tbc_calendar_')
        );
        if (userCacheKeys.length > 0) {
          await AsyncStorage.multiRemove(userCacheKeys);
          log('Cleared', userCacheKeys.length, 'cached keys');
        }
      } catch (e) {
        log('Error clearing app caches:', e);
      }

      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      if (__DEV__) console.error('[Auth] Logout error:', error);
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    await checkAuthStatus();
  }, []);

  const updateUser = useCallback(async (updates: Partial<AuthUser>) => {
    await authService.updateStoredUser(updates);
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const registerAndLogin = useCallback(async (
    accessToken: string,
    refreshToken: string,
    userData: AuthUser,
  ) => {
    await authService.storeAuthDirect(accessToken, refreshToken, userData);
    setUser(userData);
    setIsAuthenticated(true);
  }, []);

  const value = useMemo(() => ({
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    refreshAuth,
    updateUser,
    registerAndLogin,
  }), [isAuthenticated, isLoading, user, login, logout, refreshAuth, updateUser, registerAndLogin]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
