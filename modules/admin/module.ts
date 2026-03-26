// =============================================================================
// ADMIN MODULE - Admin launcher item (WebView)
// =============================================================================
// Launcher-only module — adds an "Admin" tile to the Launcher
// that opens the WordPress admin area in a WebView.
// =============================================================================

import type { ModuleManifest } from '@/modules/_types';
import { SITE_URL } from '@/constants/config';

export const adminModule: ModuleManifest = {
  id: 'admin',
  name: 'Admin',
  version: '1.0.0',
  description: 'Admin launcher item (WebView)',
  author: 'Two Birds Code',
  authorUrl: 'https://twobirdscode.com',
  license: 'Proprietary',

  launcherItems: [
    {
      id: 'admin',
      label: 'Admin',
      icon: 'shield-outline',
      route: {
        pathname: '/webview',
        params: {
          url: `${SITE_URL}/tbc-admin/`,
          title: 'Admin',
        },
      },
      order: 70,
      hideKey: 'admin',
      iconColor: 'warning',
      iconBackground: 'warning',
    },
  ],
};
