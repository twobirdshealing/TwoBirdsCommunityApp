// =============================================================================
// USE REACTION CONFIG - Fetches and caches reaction config from plugin API
// =============================================================================
// Calls GET /tbc-multi-reactions/v1/config once per app session.
// All components share the same cached result via module-level variable.
// Returns empty config if API fails (reactions won't render).
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { SITE_URL } from '@/constants/config';
import { request } from '@/services/api/client';
import { createLogger } from '@/utils/logger';
import { registerCache } from '@/services/cacheRegistry';

const log = createLogger('ReactionConfig');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ReactionConfig {
  id: string;
  name: string;
  emoji: string;
  icon_url: string | null;
  color: string;
  order: number;
}

export interface DisplayConfig {
  count: number;   // How many emoji icons to show in breakdown summary
  overlap: number; // Negative margin overlap in px
  stroke: number;  // Border width on summary icons in px
}

interface ConfigResult {
  reactions: ReactionConfig[];
  display: DisplayConfig;
}

// -----------------------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------------------

const DEFAULT_DISPLAY: DisplayConfig = { count: 5, overlap: 8, stroke: 0 };
const EMPTY_CONFIG: ConfigResult = { reactions: [], display: DEFAULT_DISPLAY };

// -----------------------------------------------------------------------------
// Module-level cache (shared across all hook instances)
// -----------------------------------------------------------------------------

let cachedConfig: ConfigResult | null = null;
let fetchPromise: Promise<ConfigResult> | null = null;

// Self-register so clearAllUserCaches() handles this on logout
registerCache({ clearMemory: () => { cachedConfig = null; fetchPromise = null; } });

const TBC_MR_URL = `${SITE_URL}/wp-json/tbc-multi-reactions/v1`;

async function fetchReactionConfig(): Promise<ConfigResult> {
  try {
    const result = await request<{ reactions?: ReactionConfig[]; display?: Partial<DisplayConfig> }>('/config', { baseUrl: TBC_MR_URL });

    if (!result.success) {
      log.warn('API error:', { message: result.error.message });
      return EMPTY_CONFIG;
    }

    const data = result.data;

    if (data?.reactions?.length) {
      // Normalize reactions: treat empty string icon_url as null
      const reactions = data.reactions.map((r: any) => ({
        id: r.id,
        name: r.name || r.id,
        emoji: r.emoji || '',
        icon_url: r.icon_url && r.icon_url.length > 0 ? r.icon_url : null,
        color: r.color || '#1877F2',
        order: r.order ?? 0,
      }));

      // Parse display settings from API (with fallback defaults)
      const display: DisplayConfig = {
        count: data.display?.count ?? DEFAULT_DISPLAY.count,
        overlap: data.display?.overlap ?? DEFAULT_DISPLAY.overlap,
        stroke: data.display?.stroke ?? DEFAULT_DISPLAY.stroke,
      };

      return { reactions, display };
    }

    return EMPTY_CONFIG;
  } catch (err) {
    log.warn('Fetch failed:', { err });
    return EMPTY_CONFIG;
  }
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useReactionConfig() {
  const [reactions, setReactions] = useState<ReactionConfig[]>(
    cachedConfig?.reactions || []
  );
  const [display, setDisplay] = useState<DisplayConfig>(
    cachedConfig?.display || DEFAULT_DISPLAY
  );
  const [loading, setLoading] = useState(!cachedConfig);

  useEffect(() => {
    if (cachedConfig) {
      setReactions(cachedConfig.reactions);
      setDisplay(cachedConfig.display);
      setLoading(false);
      return;
    }

    // Deduplicate: if another instance is already fetching, reuse its promise
    if (!fetchPromise) {
      fetchPromise = fetchReactionConfig();
    }

    fetchPromise.then((result) => {
      cachedConfig = result;
      fetchPromise = null;
      setReactions(result.reactions);
      setDisplay(result.display);
      setLoading(false);
    });
  }, []);

  const getReaction = useCallback(
    (type: string): ReactionConfig | null => {
      return reactions.find((r) => r.id === type) || null;
    },
    [reactions]
  );

  return { reactions, display, loading, getReaction };
}
