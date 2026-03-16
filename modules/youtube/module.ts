// =============================================================================
// YOUTUBE MODULE - Channel videos and playlists via YouTube Data API v3
// =============================================================================
// Companion plugin: tbc-youtube (WordPress)
// API namespace: /wp-json/tbc-yt/v1
// =============================================================================

import type { ModuleManifest } from '@/modules/_types';
import { YouTubeWidget } from './widgets/YouTubeWidget';

export const youtubeModule: ModuleManifest = {
  id: 'youtube',
  name: 'YouTube',
  version: '1.0.0',
  description: 'Channel videos and playlists via YouTube Data API v3',
  author: 'Two Birds Code',
  authorUrl: 'https://twobirdscode.com',
  license: 'Proprietary',

  // No bottom tab — accessed via home widget "See All" link

  widgets: [
    {
      id: 'latest-youtube',         // Same ID as previous core widget — preserves user preferences
      title: 'YouTube',
      icon: 'logo-youtube',
      seeAllRoute: '/youtube',
      defaultEnabled: true,
      canDisable: true,
      externalWrapper: true,
      component: YouTubeWidget,
    },
  ],

  routePrefixes: ['/youtube'],
  companionPlugin: 'tbc-youtube',
};
