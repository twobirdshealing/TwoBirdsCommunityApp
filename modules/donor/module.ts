// =============================================================================
// DONOR MODULE - Donor Dashboard launcher item (WebView)
// =============================================================================
// Launcher-only module — adds a "Donor Dashboard" tile to the Launcher
// that opens the WordPress donor dashboard page in a WebView.
// =============================================================================

import type { ModuleManifest } from '@/modules/_types';
import { SITE_URL } from '@/constants/config';

export const donorModule: ModuleManifest = {
  id: 'donor',
  name: 'Donor Dashboard',
  version: '1.0.0',
  description: 'Donor Dashboard launcher item (WebView)',
  author: 'Two Birds Code',
  authorUrl: 'https://twobirdscode.com',
  license: 'Proprietary',

  launcherItems: [
    {
      id: 'donor-dashboard',
      label: 'Donor Dashboard',
      icon: 'wallet-outline',
      route: {
        pathname: '/webview',
        params: {
          url: `${SITE_URL}/donor-dashboard/`, // SETUP: Path to your donor dashboard page
          title: 'Donor Dashboard',
        },
      },
      order: 65,
      hideKey: 'donor_dashboard',
    },
  ],
};
