// =============================================================================
// CART MODULE - Native WooCommerce cart with bottom sheet UI
// =============================================================================
// Adds a cart icon to the TopHeader that opens a native bottom sheet cart.
// Badge count is synced via X-TBC-Cart-Count response header on every
// authenticated API call. Requires the tbc-cart WordPress plugin (v3.0.0+).
//
// Disable by removing this module from modules/_registry.ts.
// =============================================================================

import type { ModuleManifest } from '../_types';
import { CartProvider, useCartCount, useCartSheet } from './CartContext';

/** Hook returning the cart sheet opener — used by useOnPress in header icon. */
function useCartPress(): () => void {
  const { openCart } = useCartSheet();
  return openCart;
}

export const cartModule: ModuleManifest = {
  id: 'cart',
  name: 'WooCommerce Cart',
  version: '2.0.0',
  description: 'Native WooCommerce cart with bottom sheet UI',
  author: 'Two Birds Code',
  authorUrl: 'https://twobirdscode.com',
  license: 'Proprietary',
  companionPlugin: 'tbc-cart',
  hideMenuKey: 'cart',

  headerIcons: [
    {
      id: 'cart',
      icon: 'cart-outline',
      order: 30,
      accessibilityLabel: 'Cart',
      hideMenuKey: 'cart',
      useBadgeCount: useCartCount,
      useOnPress: useCartPress,
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
