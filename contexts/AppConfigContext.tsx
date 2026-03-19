// =============================================================================
// APP CONFIG CONTEXT - Auth-aware visibility & portal slug state
// =============================================================================
// Thin state holder for visibility flags and portal slug.
// Data is fed in from _layout.tsx (via setFromBatch or refreshAllConfig).
// Does NOT fetch on its own — all fetching is orchestrated by _layout.tsx.
// =============================================================================

import { AppConfigResponse, FeaturesConfig, RegistrationConfig, SocketConfig, VisibilityConfig } from '@/services/api/appConfig';
import { createLogger } from '@/utils/logger';
import { FEATURES_CACHE_KEY, setFeatureFlagCache } from '@/utils/featureFlags';
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
  /** Registration capabilities from server — null until app-config loads */
  registration: RegistrationConfig | null;
  /** Whether the site uses 24-hour time format (derived from WordPress time_format setting) */
  is24Hour: boolean;
  /** Feature flags from server (wp-admin controlled) — null until config loads */
  features: FeaturesConfig | null;
  /** Accept pre-fetched data from the startup batch or _layout refresh */
  setFromBatch: (data: AppConfigResponse) => void;
}

// -----------------------------------------------------------------------------
// Storage
// -----------------------------------------------------------------------------

const VISIBILITY_CACHE_KEY = 'tbc_app_visibility_cache';
const SOCKET_CACHE_KEY = 'tbc_socket_config_cache';
const REGISTRATION_CACHE_KEY = 'tbc_registration_config_cache';
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
  const [registration, setRegistration] = useState<RegistrationConfig | null>(null);
  const [is24Hour, setIs24Hour] = useState(false);
  const [features, setFeatures] = useState<FeaturesConfig | null>(null);

  const applyConfig = useCallback((data: AppConfigResponse) => {
    if (data.visibility) {
      setVisibility(data.visibility);
      AsyncStorage.setItem(VISIBILITY_CACHE_KEY, JSON.stringify(data.visibility)).catch((e) => log.warn('Visibility cache write failed:', e));
    }
    if (data.portal_slug !== undefined) {
      setPortalSlug(data.portal_slug);
    }
    if (data.socket) {
      // Shallow-compare key fields to avoid new reference → unnecessary Pusher reconnect
      setSocketConfig(prev => {
        if (prev
          && prev.api_key === data.socket!.api_key
          && prev.options?.cluster === data.socket!.options?.cluster
          && prev.options?.wsHost === data.socket!.options?.wsHost) {
          return prev;
        }
        return data.socket!;
      });
      AsyncStorage.setItem(SOCKET_CACHE_KEY, JSON.stringify(data.socket)).catch((e) => log.warn('Socket config cache write failed:', e));
    }
    if (data.registration) {
      setRegistration(data.registration);
      AsyncStorage.setItem(REGISTRATION_CACHE_KEY, JSON.stringify(data.registration)).catch((e) => log.warn('Registration config cache write failed:', e));
    }
    if (data.features) {
      // Stable-reference guard: only update if values actually changed
      const incoming = JSON.stringify(data.features);
      setFeatures(prev => JSON.stringify(prev) === incoming ? prev : data.features!);
      setFeatureFlagCache(data.features);
      AsyncStorage.setItem(FEATURES_CACHE_KEY, incoming).catch((e) => log.warn('Features cache write failed:', e));
    }
    // WordPress PHP time format: 'H' or 'G' = 24-hour, 'g' or 'h' = 12-hour
    if (data.time_format) {
      const use24 = /[HG]/.test(data.time_format);
      setIs24Hour(use24);
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
        const [cached, cachedSocket, cachedReg, cachedFeatures] = await Promise.all([
          AsyncStorage.getItem(VISIBILITY_CACHE_KEY),
          AsyncStorage.getItem(SOCKET_CACHE_KEY),
          AsyncStorage.getItem(REGISTRATION_CACHE_KEY),
          AsyncStorage.getItem(FEATURES_CACHE_KEY),
        ]);
        if (cached) setVisibility(JSON.parse(cached));
        if (cachedSocket) setSocketConfig(JSON.parse(cachedSocket));
        if (cachedReg) setRegistration(JSON.parse(cachedReg));
        if (cachedFeatures) setFeatures(JSON.parse(cachedFeatures));
      } catch {}
    })();
  }, []);

  const value = useMemo(() => ({
    visibility,
    portalSlug,
    socketConfig,
    registration,
    is24Hour,
    features,
    setFromBatch,
  }), [visibility, portalSlug, socketConfig, registration, is24Hour, features, setFromBatch]);

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

/** Convenience hook for feature flags. Safe to call in authenticated screens —
 *  the startup gate in _layout.tsx guarantees config is loaded before rendering. */
export function useFeatures(): FeaturesConfig {
  const { features } = useAppConfig();
  if (!features) throw new Error('useFeatures() called before config loaded');
  return features;
}
