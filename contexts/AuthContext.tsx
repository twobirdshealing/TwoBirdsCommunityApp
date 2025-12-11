// =============================================================================
// AUTH CONTEXT - Global authentication state
// =============================================================================
// Provides auth state to entire app via React Context.
// Wrap your app with <AuthProvider> and use useAuth() hook anywhere.
// =============================================================================

import {
  login as authLogin,
  logout as authLogout,
  AuthUser,
  getStoredAuth,
} from '@/services/auth';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

// Debug mode
const DEBUG = true;
function log(...args: any[]) {
  if (DEBUG) console.log('[AuthContext]', ...args);
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
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
  const [user, setUser] = useState<AuthUser | null>(null);

  // Load stored auth on mount
  useEffect(() => {
    async function loadAuth() {
      log('Loading auth on mount...');
      
      try {
        const stored = await getStoredAuth();
        log('Stored auth result:', { 
          isAuthenticated: stored.isAuthenticated, 
          hasUser: !!stored.user,
          username: stored.user?.username 
        });
        
        if (stored.isAuthenticated && stored.user) {
          // Skip token validation for now - just trust stored credentials
          // This prevents the "flash to login" issue
          log('Using stored credentials (skipping validation)');
          setIsAuthenticated(true);
          setUser(stored.user);
        } else {
          log('No stored auth, user needs to login');
        }
      } catch (error) {
        log('Error loading auth:', error);
      } finally {
        log('Auth loading complete');
        setIsLoading(false);
      }
    }

    loadAuth();
  }, []);

  // Login
  const login = useCallback(async (username: string, password: string) => {
    log('Login called for:', username);
    setIsLoading(true);
    
    try {
      const result = await authLogin(username, password);
      log('Login result:', result.success);
      
      if (result.success) {
        setIsAuthenticated(true);
        setUser(result.user);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Logout
  const logout = useCallback(async () => {
    log('Logout called');
    setIsLoading(true);
    
    try {
      await authLogout();
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    log('Refreshing user...');
    const stored = await getStoredAuth();
    if (stored.user) {
      setUser(stored.user);
    }
  }, []);

  log('Render state:', { isAuthenticated, isLoading, hasUser: !!user });

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        login,
        logout,
        refreshUser,
      }}
    >
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