// =============================================================================
// EXPO CONFIG BUILDER - Core deep link and platform config logic
// =============================================================================
// This file is CORE — it gets overwritten on updates. Do not edit.
// For site URL, app name, and module deep links, edit app.config.ts.
// =============================================================================

import { ExpoConfig } from 'expo/config';

interface ExpoConfigOptions {
  siteUrl: string;
  name: string;
  slug: string;
  moduleDeepLinkPaths: string[];
}

/**
 * Build the full Expo config with deep links, associated domains, and intent filters.
 * Called by app.config.ts with buyer-specific values.
 */
export function buildExpoConfig(
  config: ExpoConfig,
  options: ExpoConfigOptions,
): ExpoConfig {
  const { siteUrl, name, slug, moduleDeepLinkPaths } = options;
  const hostname = new URL(siteUrl).hostname;

  return {
    ...config,
    name,
    slug,
    ios: {
      ...config.ios,
      associatedDomains: [`applinks:${hostname}`],
    },
    android: {
      ...config.android,
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            // Core deep links
            { scheme: 'https', host: hostname, pathPrefix: '/spaces/' },
            { scheme: 'https', host: hostname, pathPrefix: '/u/' },
            { scheme: 'https', host: hostname, pathPrefix: '/courses/' },
            { scheme: 'https', host: hostname, pathPrefix: '/notifications' },
            { scheme: 'https', host: hostname, pathPrefix: '/leaderboard' },
            { scheme: 'https', host: hostname, pathPrefix: '/chat/' },
            // Module deep links (from buyer's app.config.ts)
            ...moduleDeepLinkPaths.map((p) => ({ scheme: 'https', host: hostname, pathPrefix: p })),
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    extra: {
      ...config.extra,
      siteUrl,
    },
  };
}
