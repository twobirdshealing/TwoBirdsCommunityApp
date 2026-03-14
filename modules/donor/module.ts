// =============================================================================
// DONOR MODULE - Donor Dashboard menu item (WebView)
// =============================================================================
// Menu-only module — adds a "Donor Dashboard" entry to the avatar dropdown
// that opens the WordPress donor dashboard page in a WebView.
// =============================================================================

import type { ModuleManifest } from '@/modules/_types';
import { SITE_URL } from '@/constants/config';

export const donorModule: ModuleManifest = {
  id: 'donor',
  name: 'Donor Dashboard',
  version: '1.0.0',

  menuItems: [
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
      hideMenuKey: 'donor_dashboard',
    },
  ],
};
