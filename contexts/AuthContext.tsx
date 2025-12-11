// =============================================================================
// AUTH CONTEXT - Global authentication state
// =============================================================================
// Provides auth state to entire app via React Context.
// Wrap your app with <AuthProvider> and use useAuth() hook anywhere.
// =============================================================================

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  login as authLogin,
  logout as authLogout,
  getStoredAuth,
  validateToken,
  AuthUser,
} from '@/services/auth';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AuthContextType {
  // State
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthUser | null;
  
  // Actions
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
      try {
        const stored = await getStoredAuth();
        
        if (stored.isAuthenticated && stored.user) {
          // Optionally validate the token is still good
          const isValid = await validateToken();
          
          if (isValid) {
            setIsAuthenticated(true);
            setUser(stored.user);
          } else {
            // Token expired or revoked, clear it
            await authLogout();
            setIsAuthenticated(false);
            setUser(null);
          }
        }
      } catch (error) {
        console.error('[AuthContext] Error loading auth:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAuth();
  }, []);

  // Login
  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    
    try {
      const result = await authLogin(username, password);
      
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
    const stored = await getStoredAuth();
    if (stored.user) {
      setUser(stored.user);
    }
  }, []);

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
