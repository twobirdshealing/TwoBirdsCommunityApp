// =============================================================================
// AUTH CONTEXT - Global authentication state
// =============================================================================

import * as authService from '@/services/auth';
import { clearAllUserCaches } from '@/services/cacheRegistry';
import { ensurePushTokenRegistered } from '@/services/push';
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

          // Re-register push token on every app start (token may have changed)
          authService.getAuthToken().then(ensurePushTokenRegistered);

        } else {
          // Has auth but no user info - clear it
          await authService.clearAuth();
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      log.error(error, 'Check status error');
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
      log.error(error, 'Login error');
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();

      // Clear all user-specific caches (MMKV + TanStack Query + in-memory)
      clearAllUserCaches();

      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      log.error(error, 'Logout error');
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

    ensurePushTokenRegistered(accessToken);
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
