// =============================================================================
// APP CONFIG - Expo requires this file name (do not rename)
// =============================================================================
// Reads SITE_URL from eas.json and wires up deep links automatically.
// SETUP: Add a pathPrefix line below for any module that needs deep linking.
// =============================================================================

import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // SETUP: Change the fallback URL to your site. EAS builds use eas.json env instead.
  const siteUrl =
    process.env.SITE_URL || 'https://community.twobirdschurch.com';
  const hostname = new URL(siteUrl).hostname;

  return {
    ...config,
    name: config.name ?? 'Two Birds',
    slug: config.slug ?? 'twobirdscommunityapp',
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
            // Module deep links — SETUP: add one line per module that needs deep linking
            { scheme: 'https', host: hostname, pathPrefix: '/blog/' },
            { scheme: 'https', host: hostname, pathPrefix: '/bookclub/' },
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
