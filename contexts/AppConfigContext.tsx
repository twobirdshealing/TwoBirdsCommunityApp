// =============================================================================
// APP CONFIG CONTEXT - Auth-aware config for maintenance bypass & UI visibility
// =============================================================================
// On startup, the batch API provides config data via setFromBatch().
// On app resume, refreshConfig() re-fetches independently.
// Sits inside AuthProvider in the provider tree.
// =============================================================================

import { useAuth } from '@/contexts/AuthContext';
import { useAppFocus } from '@/hooks/useAppFocus';
import { AppConfigResponse, getAppConfigAuthenticated, VisibilityConfig } from '@/services/api/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AppConfigContextType {
  visibility: VisibilityConfig | null;
  /** null = still loading, true = can bypass, false = cannot bypass */
  maintenanceBypass: boolean | null;
  /** Fluent Community portal slug (for deep link URL mapping) */
  portalSlug: string;
  refreshConfig: () => Promise<void>;
  /** Accept pre-fetched data from the startup batch (skips own fetch) */
  setFromBatch: (data: AppConfigResponse) => void;
}

// -----------------------------------------------------------------------------
// Storage
// -----------------------------------------------------------------------------

const VISIBILITY_CACHE_KEY = 'tbc_app_visibility_cache';

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [visibility, setVisibility] = useState<VisibilityConfig | null>(null);
  const [maintenanceBypass, setMaintenanceBypass] = useState<boolean | null>(null);
  const [portalSlug, setPortalSlug] = useState('');
  /** Tracks whether the batch already provided data for this auth session */
  const batchProvided = useRef(false);

  const applyConfig = useCallback((data: AppConfigResponse) => {
    if (data.visibility) {
      setVisibility(data.visibility);
      AsyncStorage.setItem(VISIBILITY_CACHE_KEY, JSON.stringify(data.visibility)).catch(() => {});
    }
    if (data.portal_slug !== undefined) {
      setPortalSlug(data.portal_slug);
    }
    setMaintenanceBypass(data.maintenance?.can_bypass ?? false);
  }, []);

  const refreshConfig = useCallback(async () => {
    if (!isAuthenticated) {
      setVisibility(null);
      setMaintenanceBypass(null);
      return;
    }

    const data = await getAppConfigAuthenticated();
    if (!data) return;
    applyConfig(data);
  }, [isAuthenticated, applyConfig]);

  /** Called by useStartupData with batch response — skips the initial fetch */
  const setFromBatch = useCallback((data: AppConfigResponse) => {
    batchProvided.current = true;
    applyConfig(data);
  }, [applyConfig]);

  // Load cached visibility on mount
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(VISIBILITY_CACHE_KEY);
        if (cached) setVisibility(JSON.parse(cached));
      } catch {}
    })();
  }, []);

  // Refresh when auth state changes — but skip if batch already provided data
  useEffect(() => {
    if (isAuthenticated) {
      // Give the batch a moment to provide data before falling back to own fetch
      const timer = setTimeout(() => {
        if (!batchProvided.current) {
          refreshConfig();
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      batchProvided.current = false;
      setVisibility(null);
      setMaintenanceBypass(null);
      AsyncStorage.removeItem(VISIBILITY_CACHE_KEY).catch(() => {});
    }
  }, [isAuthenticated, refreshConfig]);

  // Refresh on app resume (always — batch only runs on initial startup)
  useAppFocus(useCallback(() => refreshConfig(), [refreshConfig]), isAuthenticated);

  const value = useMemo(() => ({
    visibility,
    maintenanceBypass,
    portalSlug,
    refreshConfig,
    setFromBatch,
  }), [visibility, maintenanceBypass, portalSlug, refreshConfig, setFromBatch]);

  return (
    <AppConfigContext.Provider value={value}>
      {children}
    </AppConfigContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useAppConfig() {
  const context = useContext(AppConfigContext);
  if (context === undefined) {
    throw new Error('useAppConfig must be used within an AppConfigProvider');
  }
  return context;
}
