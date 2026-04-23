// =============================================================================
// APP CONFIG - Expo requires this file name (do not rename)
// =============================================================================
// Reads EXPO_PUBLIC_SITE_URL from eas.json and wires up deep links automatically.
// =============================================================================

import type { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // =========================================================================
  // YOUR CONFIG — Edit these values to match your site.
  // This section is yours to edit. Core updates won't touch it.
  // =========================================================================

  // Production site URL (EAS builds use eas.json env instead)
  const productionUrl = 'https://community.twobirdschurch.com';

  // Staging site URL (optional — for local dev testing against a staging server)
  // Leave empty if you don't have a staging site. Run: npm run dev:staging
  const stagingUrl = 'https://staging.twobirdschurch.com';

  const siteUrl =
    process.env.EXPO_PUBLIC_SITE_URL ||
    (process.env.EXPO_PUBLIC_USE_STAGING === '1' && stagingUrl ? stagingUrl : productionUrl);

  // Fallback values for local dev (EAS builds use app.json instead)
  const name = config.name ?? 'Two Birds';
  const slug = config.slug ?? 'twobirdscommunityapp';

  // Module deep links — add one path per module that needs deep linking
  const moduleDeepLinkPaths: string[] = [
    '/blog/',
    '/bookclub/',
  ];

  // =========================================================================
  // END YOUR CONFIG — Everything below is core. Do not edit.
  // =========================================================================

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
            // Module deep links (from YOUR CONFIG above)
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
};
