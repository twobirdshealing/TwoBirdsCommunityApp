// =============================================================================
// BLOG MODULE - WordPress blog posts and comments
// =============================================================================
// Uses standard WP REST API (/wp-json/wp/v2) — no companion plugin required.
// Provides: home widget, menu item, blog list/detail/comments screens.
// =============================================================================

import type { ModuleManifest } from '@/modules/_types';
import { BlogWidget } from './widgets/BlogWidget';

export const blogModule: ModuleManifest = {
  id: 'blog',
  name: 'Blog',
  version: '1.0.0',

  // No bottom tab — accessed via home widget "See All" and menu item

  widgets: [
    {
      id: 'latest-blog',         // Same ID — preserves user widget preferences
      title: 'Latest Blog',
      icon: 'newspaper-outline',
      seeAllRoute: '/blog',
      defaultEnabled: true,
      canDisable: true,
      externalWrapper: true,
      component: BlogWidget,
    },
  ],

  menuItems: [
    {
      id: 'blog',
      label: 'Blog',
      icon: 'newspaper-outline',
      route: '/blog',
      order: 60,
      hideMenuKey: 'blog',
    },
  ],

  routePrefixes: ['/blog', '/blog-comments'],
};
