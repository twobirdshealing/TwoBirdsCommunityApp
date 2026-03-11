// =============================================================================
// APP CONFIG - Dynamic Expo configuration
// =============================================================================
// Extends app.json with environment-based URLs for deep linking.
// All static config (version, icons, plugins) lives in app.json.
// When production domain is ready, change one line in eas.json.
// =============================================================================

import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  // Read from EAS env or fall back to staging
  const siteUrl =
    process.env.SITE_URL || 'https://staging.twobirdschurch.com';
  const hostname = new URL(siteUrl).hostname;

  return {
    ...config,
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
            { scheme: 'https', host: hostname, pathPrefix: '/spaces/' },
            { scheme: 'https', host: hostname, pathPrefix: '/u/' },
            { scheme: 'https', host: hostname, pathPrefix: '/courses/' },
            { scheme: 'https', host: hostname, pathPrefix: '/notifications' },
            { scheme: 'https', host: hostname, pathPrefix: '/leaderboard' },
            { scheme: 'https', host: hostname, pathPrefix: '/blog/' },
            { scheme: 'https', host: hostname, pathPrefix: '/chat/' },
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
