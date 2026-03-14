// =============================================================================
// DONATE MODULE - Donation tab that opens WebView
// =============================================================================
// No standalone screens — tab press is intercepted to open /webview with the
// donation page URL. The tab icon is an animated pulsing heart in red.
// =============================================================================

import type { ModuleManifest } from '@/modules/_types';
import { SITE_URL } from '@/constants/config';
import { DonateTabIcon } from './components/DonateTabIcon';

const DONATE_ROUTE_PARAMS = {
  url: `${SITE_URL}/calendar/donate/`,
  title: 'Donate',
  rightIcon: 'cart-outline',
  rightAction: 'cart',
};

export const donateModule: ModuleManifest = {
  id: 'donate',
  name: 'Donate',
  version: '1.0.0',

  tab: {
    name: 'donate',
    title: 'Donate',
    icon: 'heart',
    iconOutline: 'heart-outline',
    order: 100,
    component: () => null, // Never renders — interceptPress opens WebView
    hideMenuKey: 'donate',
    tabColor: 'error', // uses themeColors.error (red) instead of active/inactive
    tabBarIcon: ({ focused, color }) => (
      <DonateTabIcon focused={focused} color={color} />
    ),
    interceptPress: (router) => {
      router.push({ pathname: '/webview', params: DONATE_ROUTE_PARAMS });
    },
  },

  menuItems: [
    {
      id: 'donate',
      label: 'Donate',
      icon: 'heart-outline',
      route: { pathname: '/webview', params: DONATE_ROUTE_PARAMS },
      order: 60,
      hideMenuKey: 'donate',
      iconColor: 'error',
    },
  ],
};
