// =============================================================================
// CART CONTEXT - WooCommerce cart count state for the cart module
// =============================================================================
// Subscribes to response header updates (X-TBC-Cart-Count) via the API client
// listener system. The count arrives on every authenticated API response,
// including the startup batch — no dedicated fetch needed.
// =============================================================================

import { createContext, useContext, useEffect, useState } from 'react';
import { addResponseHeaderListener } from '@/services/api/client';

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const CartCountContext = createContext<number>(0);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    return addResponseHeaderListener((data) => {
      if (data.cartCount !== undefined) {
        setCartCount((prev) => data.cartCount === prev ? prev : data.cartCount!);
      }
    });
  }, []);

  return (
    <CartCountContext.Provider value={cartCount}>
      {children}
    </CartCountContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/** Returns the current cart item count. Safe to call outside provider (returns 0). */
export function useCartCount(): number {
  return useContext(CartCountContext);
}
