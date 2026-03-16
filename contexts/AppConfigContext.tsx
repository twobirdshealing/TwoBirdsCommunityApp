// =============================================================================
// APP CONFIG CONTEXT - Auth-aware visibility & portal slug state
// =============================================================================
// Thin state holder for visibility flags and portal slug.
// Data is fed in from _layout.tsx (via setFromBatch or refreshAllConfig).
// Does NOT fetch on its own — all fetching is orchestrated by _layout.tsx.
// =============================================================================

import { AppConfigResponse, SocketConfig, VisibilityConfig } from '@/services/api/appConfig';
import { createLogger } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useMemo, useEffect, useState } from 'react';

const log = createLogger('AppConfig');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AppConfigContextType {
  visibility: VisibilityConfig | null;
  /** Fluent Community portal slug (for deep link URL mapping) */
  portalSlug: string;
  /** Socket config from server (Pusher/Fluent Socket/Soketi) — null until app-config loads */
  socketConfig: SocketConfig | null;
  /** Accept pre-fetched data from the startup batch or _layout refresh */
  setFromBatch: (data: AppConfigResponse) => void;
}

// -----------------------------------------------------------------------------
// Storage
// -----------------------------------------------------------------------------

const VISIBILITY_CACHE_KEY = 'tbc_app_visibility_cache';
const SOCKET_CACHE_KEY = 'tbc_socket_config_cache';

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [visibility, setVisibility] = useState<VisibilityConfig | null>(null);
  const [portalSlug, setPortalSlug] = useState('');
  const [socketConfig, setSocketConfig] = useState<SocketConfig | null>(null);

  const applyConfig = useCallback((data: AppConfigResponse) => {
    if (data.visibility) {
      setVisibility(data.visibility);
      AsyncStorage.setItem(VISIBILITY_CACHE_KEY, JSON.stringify(data.visibility)).catch((e) => log.warn('Visibility cache write failed:', e));
    }
    if (data.portal_slug !== undefined) {
      setPortalSlug(data.portal_slug);
    }
    if (data.socket) {
      setSocketConfig(data.socket);
      AsyncStorage.setItem(SOCKET_CACHE_KEY, JSON.stringify(data.socket)).catch((e) => log.warn('Socket config cache write failed:', e));
    }
  }, []);

  /** Called by _layout.tsx with batch or refresh data */
  const setFromBatch = useCallback((data: AppConfigResponse) => {
    applyConfig(data);
  }, [applyConfig]);

  // Load cached visibility on mount
  useEffect(() => {
    (async () => {
      try {
        const [cached, cachedSocket] = await Promise.all([
          AsyncStorage.getItem(VISIBILITY_CACHE_KEY),
          AsyncStorage.getItem(SOCKET_CACHE_KEY),
        ]);
        if (cached) setVisibility(JSON.parse(cached));
        if (cachedSocket) setSocketConfig(JSON.parse(cachedSocket));
      } catch {}
    })();
  }, []);

  const value = useMemo(() => ({
    visibility,
    portalSlug,
    socketConfig,
    setFromBatch,
  }), [visibility, portalSlug, socketConfig, setFromBatch]);

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
