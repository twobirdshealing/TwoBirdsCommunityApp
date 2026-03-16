// =============================================================================
// APP CONFIG - Expo requires this file name (do not rename)
// =============================================================================
// Reads SITE_URL from eas.json and wires up deep links automatically.
// =============================================================================

import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // =========================================================================
  // YOUR CONFIG — Edit these values to match your site.
  // This section is yours to edit. Core updates won't touch it.
  // =========================================================================

  // Change the fallback URL to your site. EAS builds use eas.json env instead.
  const siteUrl =
    process.env.SITE_URL || 'https://community.twobirdschurch.com';

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
