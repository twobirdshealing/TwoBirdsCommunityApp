// =============================================================================
// AUTH CONTEXT - Global authentication state
// =============================================================================

import * as authService from '@/services/auth';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

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

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Check auth status on mount
  useEffect(() => {
    checkAuthStatus();
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
        } else {
          // Has auth but no user info - clear it
          await authService.clearAuth();
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('[Auth] Check status error:', error);
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
      console.error('[Auth] Login error:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      // Clear state anyway
      setUser(null);
      setIsAuthenticated(false);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    await checkAuthStatus();
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      user,
      login,
      logout,
      refreshAuth,
    }}>
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
