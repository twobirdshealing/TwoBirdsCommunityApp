// =============================================================================
// BOOK CLUB MODULE - Audiobook player with bookmarks and meetings
// =============================================================================
// Companion plugin: tbc-book-club (WordPress)
// API namespace: /wp-json/tbc-bc/v1
// =============================================================================

import type { ModuleManifest } from '@/modules/_types';
import { BookClubWidget } from './widgets/BookClubWidget';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { MiniPlayer } from './components/MiniPlayer';

export const bookclubModule: ModuleManifest = {
  id: 'bookclub',
  name: 'Book Club',
  version: '1.0.0',
  description: 'Audiobook player with bookmarks and meetings',
  author: 'Two Birds Code',
  authorUrl: 'https://twobirdscode.com',
  license: 'Proprietary',

  // No bottom tab — accessed via home widget and /bookclub routes

  // Audio player context — provides playback state to bookclub screens
  providers: [
    {
      id: 'bookclub-audio',
      order: 50,
      component: AudioPlayerProvider,
    },
  ],

  // Mini player — renders above the tab bar when audio is playing
  tabBarAddon: MiniPlayer,

  widgets: [
    {
      id: 'book-club',
      title: 'Book Club',
      icon: 'book-outline',
      seeAllRoute: '/bookclub',
      defaultEnabled: true,

      component: BookClubWidget,
      hideKey: 'bookclub',
    },
  ],

  // Launcher item in bottom sheet grid
  launcherItems: [
    {
      id: 'bookclub',
      label: 'Book Club',
      icon: 'book-outline',
      route: '/bookclub',
      order: 55,
      hideKey: 'bookclub',
    },
  ],

  routePrefixes: ['/bookclub'],
  routes: ['bookclub'],
  hideMenuKey: 'bookclub',
  companionPlugin: 'tbc-book-club',
  apiBase: '/wp-json/tbc-bc/v1',
};
