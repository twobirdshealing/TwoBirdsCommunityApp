// =============================================================================
// USE REACTION CONFIG - Fetches and caches reaction config from plugin API
// =============================================================================
// Calls GET /tbc-multi-reactions/v1/config once per app session.
// All components share the same cached result via module-level variable.
// Falls back to hardcoded constants if API fails or hasn't loaded yet.
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { TBC_MR_URL } from '@/constants/config';
import { request } from '@/services/api/client';
import { REACTION_EMOJI, REACTION_COLORS, REACTION_NAMES, REACTION_TYPES } from '@/constants/reactions';
import { ReactionType } from '@/types/feed';

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

// -----------------------------------------------------------------------------
// Module-level cache (shared across all hook instances)
// -----------------------------------------------------------------------------

let cachedConfig: ConfigResult | null = null;
let fetchPromise: Promise<ConfigResult> | null = null;

async function fetchReactionConfig(): Promise<ConfigResult> {
  try {
    const result = await request<{ reactions?: ReactionConfig[]; display?: Partial<DisplayConfig> }>('/config', { baseUrl: TBC_MR_URL });

    if (!result.success) {
      if (__DEV__) console.warn('[useReactionConfig] API error:', result.error.message);
      return buildFallbackConfig();
    }

    const data = result.data;

    if (data?.reactions && Array.isArray(data.reactions)) {
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

    return buildFallbackConfig();
  } catch (err) {
    if (__DEV__) console.warn('[useReactionConfig] Fetch failed:', err);
    return buildFallbackConfig();
  }
}

function buildFallbackConfig(): ConfigResult {
  return {
    reactions: REACTION_TYPES.map((type, i) => ({
      id: type,
      name: REACTION_NAMES[type],
      emoji: REACTION_EMOJI[type],
      icon_url: null,
      color: REACTION_COLORS[type],
      order: i + 1,
    })),
    display: DEFAULT_DISPLAY,
  };
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useReactionConfig() {
  const fallback = buildFallbackConfig();
  const [reactions, setReactions] = useState<ReactionConfig[]>(
    cachedConfig?.reactions || fallback.reactions
  );
  const [display, setDisplay] = useState<DisplayConfig>(
    cachedConfig?.display || fallback.display
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
