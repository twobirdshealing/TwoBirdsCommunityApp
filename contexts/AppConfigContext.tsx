// =============================================================================
// APP CONFIG CONTEXT - Auth-aware visibility & portal slug state
// =============================================================================
// Thin state holder for visibility flags and portal slug.
// Data is fed in from _layout.tsx (via setFromBatch or refreshAllConfig).
// Does NOT fetch on its own — all fetching is orchestrated by _layout.tsx.
// =============================================================================

import { AppConfigResponse, FeaturesConfig, RegistrationConfig, SocketConfig, VisibilityConfig } from '@/services/api/appConfig';
import { createLogger } from '@/utils/logger';
import { DEFAULT_FEATURES, FEATURES_CACHE_KEY, setFeatureFlagCache } from '@/utils/featureFlags';
import { setCrashReportingCache } from '@/utils/crashReportingCache';
import { getJSON, setJSON } from '@/services/storage';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

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
  // MMKV reads are synchronous — hydrate from cache immediately
  const [visibility, setVisibility] = useState<VisibilityConfig | null>(() => getJSON<VisibilityConfig>(VISIBILITY_CACHE_KEY));
  const [portalSlug, setPortalSlug] = useState('');
  const [socketConfig, setSocketConfig] = useState<SocketConfig | null>(() => getJSON<SocketConfig>(SOCKET_CACHE_KEY));
  const [registration, setRegistration] = useState<RegistrationConfig | null>(() => getJSON<RegistrationConfig>(REGISTRATION_CACHE_KEY));
  const [is24Hour, setIs24Hour] = useState(false);
  const [features, setFeatures] = useState<FeaturesConfig | null>(() => {
    const cached = getJSON<FeaturesConfig>(FEATURES_CACHE_KEY);
    if (cached) setFeatureFlagCache(cached);
    return cached;
  });

  const applyConfig = useCallback((data: AppConfigResponse) => {
    if (data.visibility) {
      setVisibility(data.visibility);
      setJSON(VISIBILITY_CACHE_KEY, data.visibility);
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
      setJSON(SOCKET_CACHE_KEY, data.socket);
    }
    if (data.registration) {
      setRegistration(data.registration);
      setJSON(REGISTRATION_CACHE_KEY, data.registration);
    }
    if (data.features) {
      // Stable-ref guard: skip state + cache churn if values are unchanged.
      const incoming = JSON.stringify(data.features);
      setFeatures(prev => {
        if (JSON.stringify(prev) === incoming) return prev;
        setFeatureFlagCache(data.features!);
        setJSON(FEATURES_CACHE_KEY, data.features);
        return data.features!;
      });
    }
    if (data.crash_reporting) {
      // No React state — only the MMKV cache is consumed (at module-load time
      // by app/_layout.tsx via getCrashReportingConfig). Write-through only.
      setCrashReportingCache(data.crash_reporting);
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

/** Convenience hook for feature flags. Returns safe defaults until config loads. */
export function useFeatures(): FeaturesConfig {
  const { features } = useAppConfig();
  return features ?? DEFAULT_FEATURES;
}
