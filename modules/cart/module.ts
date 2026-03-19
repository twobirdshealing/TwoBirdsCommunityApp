// =============================================================================
// CART MODULE - WooCommerce cart icon with badge count in header
// =============================================================================
// Adds a cart icon to the TopHeader that opens the WooCommerce cart page in a
// WebView. Badge count is synced via X-TBC-Cart-Count response header on every
// authenticated API call. Requires the tbc-cart WordPress plugin.
//
// Disable by removing this module from modules/_registry.ts.
// =============================================================================

import type { ModuleManifest } from '../_types';
import { SITE_URL } from '@/constants/config';
import { CartProvider, useCartCount } from './CartContext';

export const cartModule: ModuleManifest = {
  id: 'cart',
  name: 'WooCommerce Cart',
  version: '1.0.0',
  description: 'WooCommerce cart icon with badge count in the header',
  author: 'Two Birds Code',
  authorUrl: 'https://twobirdscode.com',
  license: 'Proprietary',
  companionPlugin: 'tbc-cart',
  hideMenuKey: 'cart',

  headerIcons: [
    {
      id: 'cart',
      icon: 'cart-outline',
      route: {
        pathname: '/webview',
        params: { url: `${SITE_URL}/cart/`, title: 'Cart' },
      },
      order: 30,
      accessibilityLabel: 'Cart',
      hideMenuKey: 'cart',
      useBadgeCount: useCartCount,
    },
  ],

  responseHeaders: [
    {
      header: 'X-TBC-Cart-Count',
      key: 'cartCount',
      transform: (value) => {
        const n = parseInt(value, 10);
        return isNaN(n) || n < 0 ? 0 : n;
      },
    },
  ],

  providers: [
    {
      id: 'cart-provider',
      order: 50,
      component: CartProvider,
    },
  ],
};
