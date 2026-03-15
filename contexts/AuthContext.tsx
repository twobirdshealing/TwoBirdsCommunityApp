// =============================================================================
// AUTH CONTEXT - Global authentication state
// =============================================================================

import * as authService from '@/services/auth';
import { clearAllUserCaches } from '@/services/cacheRegistry';
import { registerDeviceToken } from '@/services/push';
import { FEATURES } from '@/constants/config';
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
  needsProfileCompletion: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => Promise<void>;
  registerAndLogin: (accessToken: string, refreshToken: string, userData: AuthUser) => Promise<void>;
  markProfileComplete: () => void;
  markProfileIncomplete: () => void;
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
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

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

          // Re-register push token on every app start (token may have changed)
          if (FEATURES.PUSH_NOTIFICATIONS) {
            authService.getAuthToken().then(token => {
              if (token) registerDeviceToken(token).catch((e) => log.warn('Push token registration failed:', e));
            });
          }

          // Profile completion is checked via X-TBC-Profile-Incomplete response headers
          // on every authenticated API call (startup batch, etc). No separate call needed here.
        } else {
          // Has auth but no user info - clear it
          await authService.clearAuth();
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      log.error('Check status error:', error);
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

        // Profile completion is detected via X-TBC-Profile-Incomplete response headers
        // on the first authenticated API call (startup batch). No separate call needed.

        return { success: true };
      } else {
        return { success: false, error: result.error || 'Login failed' };
      }
    } catch (error) {
      log.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();

      // Clear all user-specific caches (AsyncStorage + in-memory)
      await clearAllUserCaches();

      setUser(null);
      setIsAuthenticated(false);
      setNeedsProfileCompletion(false);
    } catch (error) {
      log.error('Logout error:', error);
      setUser(null);
      setIsAuthenticated(false);
      setNeedsProfileCompletion(false);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    await checkAuthStatus();
  }, []);

  const updateUser = useCallback(async (updates: Partial<AuthUser>) => {
    await authService.updateStoredUser(updates);
    setUser(prev => prev ? { ...prev, ...updates } : prev);
  }, []);

  const markProfileComplete = useCallback(() => {
    setNeedsProfileCompletion(false);
  }, []);

  const markProfileIncomplete = useCallback(() => {
    setNeedsProfileCompletion(true);
  }, []);

  const registerAndLogin = useCallback(async (
    accessToken: string,
    refreshToken: string,
    userData: AuthUser,
  ) => {
    await authService.storeAuthDirect(accessToken, refreshToken, userData);
    setUser(userData);
    setIsAuthenticated(true);

    // Register push token for new registrations
    if (FEATURES.PUSH_NOTIFICATIONS) {
      registerDeviceToken(accessToken).catch((e) => log.warn('Push token registration failed:', e));
    }
  }, []);

  const value = useMemo(() => ({
    isAuthenticated,
    isLoading,
    user,
    needsProfileCompletion,
    login,
    logout,
    refreshAuth,
    updateUser,
    registerAndLogin,
    markProfileComplete,
    markProfileIncomplete,
  }), [isAuthenticated, isLoading, user, needsProfileCompletion, login, logout, refreshAuth, updateUser, registerAndLogin, markProfileComplete, markProfileIncomplete]);

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
