// =============================================================================
// CART CONTEXT — Cart count badge + bottom sheet cart UI
// =============================================================================
// Provides:
//   useCartCount() — badge count synced via X-TBC-Cart-Count response header
//   useCartSheet() — openCart() / closeCart() to control the cart bottom sheet
//
// The CartProvider renders the BottomSheet internally so it's available from
// anywhere in the app (header icon, launcher, deep links, etc).
// =============================================================================

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { addResponseHeaderListener } from '@/services/api/client';
import { createLogger } from '@/utils/logger';
import { useTheme } from '@/contexts/ThemeContext';
import { BottomSheet, BottomSheetScrollView } from '@/components/common/BottomSheet';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { useAppQuery } from '@/hooks/useAppQuery';
import { spacing } from '@/constants/layout';
import { cartApi } from './services/cartApi';
import { CartItemRow } from './components/CartItem';
import { CartSummary } from './components/CartSummary';
import type { CartData, CartSettings } from './types';

const log = createLogger('Cart');

const DEFAULT_SETTINGS: CartSettings = {
  coupons_enabled: false,
  tax_enabled: false,
  shipping_enabled: false,
  currency_symbol: '$',
  currency_position: 'left',
  price_decimals: 2,
};

/** Type guard for tbc-cart's coupon error payload: { success, message, cart }. */
function parseCouponErrorPayload(raw: unknown): { message?: string; cart?: CartData } | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const message = typeof obj.message === 'string' ? obj.message : undefined;
  const cartObj = obj.cart;
  const cart =
    cartObj && typeof cartObj === 'object' && !Array.isArray(cartObj)
      && Array.isArray((cartObj as Record<string, unknown>).items)
      ? (cartObj as CartData)
      : undefined;
  return message || cart ? { message, cart } : null;
}

// -----------------------------------------------------------------------------
// Contexts
// -----------------------------------------------------------------------------

const CartCountContext = createContext<number>(0);
const CartSheetContext = createContext<{ openCart: () => void; closeCart: () => void }>({
  openCart: () => {},
  closeCart: () => {},
});

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [cartCount, setCartCount] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [hasOpened, setHasOpened] = useState(false);

  // -------------------------------------------------------------------------
  // Cart count from response headers
  // -------------------------------------------------------------------------

  useEffect(() => {
    return addResponseHeaderListener((data) => {
      if (data.cartCount !== undefined) {
        setCartCount((prev) => (data.cartCount === prev ? prev : data.cartCount!));
      }
    });
  }, []);

  // -------------------------------------------------------------------------
  // Cart data (only fetched after first open)
  // -------------------------------------------------------------------------

  const {
    data: cart,
    isLoading,
    error,
    refresh,
    mutate,
  } = useAppQuery<CartData>({
    cacheKey: 'tbc_cart',
    fetcher: async () => {
      log.debug('Fetching cart...');
      const result = await cartApi.getCart();
      log.debug('Cart result', result.success
        ? { itemCount: result.data.items.length }
        : { error: result.error?.message });
      if (!result.success) throw new Error(result.error?.message || 'Failed to load cart');
      return result.data;
    },
    enabled: hasOpened,
  });

  // -------------------------------------------------------------------------
  // Sheet controls
  // -------------------------------------------------------------------------

  const openCart = useCallback(() => {
    log.debug('Opening cart sheet');
    setSheetVisible(true);
    if (hasOpened) {
      refresh();
    } else {
      // First open flips the useAppQuery `enabled` gate on, triggering the
      // initial fetch. Subsequent opens call refresh() directly above.
      setHasOpened(true);
    }
  }, [hasOpened, refresh]);

  const closeCart = useCallback(() => {
    setSheetVisible(false);
    setCouponError(null);
  }, []);

  // -------------------------------------------------------------------------
  // Mutation helpers — all update local state from the returned cart
  // -------------------------------------------------------------------------

  const handleUpdateQuantity = useCallback(async (key: string, quantity: number) => {
    setMutatingKey(key);
    try {
      const result = await cartApi.updateQuantity(key, quantity);
      if (result.success) mutate(result.data);
    } finally {
      setMutatingKey(null);
    }
  }, [mutate]);

  const handleRemoveItem = useCallback(async (key: string) => {
    setMutatingKey(key);
    try {
      const result = await cartApi.removeItem(key);
      if (result.success) mutate(result.data);
    } finally {
      setMutatingKey(null);
    }
  }, [mutate]);

  const handleApplyCoupon = useCallback(async (code: string): Promise<boolean> => {
    setCouponLoading(true);
    setCouponError(null);
    try {
      const result = await cartApi.applyCoupon(code);
      if (result.success) {
        mutate(result.data);
        return true;
      }
      // tbc-cart returns { success: false, message, cart } on coupon failure
      // so the UI can refresh the cart state without a separate fetch.
      const parsed = parseCouponErrorPayload(result.error?.data?.raw);
      setCouponError(parsed?.message || result.error?.message || 'Could not apply coupon');
      if (parsed?.cart) mutate(parsed.cart);
      return false;
    } finally {
      setCouponLoading(false);
    }
  }, [mutate]);

  const handleRemoveCoupon = useCallback(async (code: string) => {
    setCouponLoading(true);
    try {
      const result = await cartApi.removeCoupon(code);
      if (result.success) mutate(result.data);
    } finally {
      setCouponLoading(false);
    }
  }, [mutate]);

  // -------------------------------------------------------------------------
  // Sheet content
  // -------------------------------------------------------------------------

  const renderSheetContent = () => {
    const hasItems = !!cart && cart.items.length > 0;
    const settings = cart?.settings ?? DEFAULT_SETTINGS;

    return (
      <BottomSheetScrollView contentContainerStyle={hasItems ? undefined : styles.centeredContainer}>
        {isLoading && <ActivityIndicator size="large" color={colors.primary} />}

        {!isLoading && error && !cart && (
          <ErrorMessage message={error.message} onRetry={refresh} fullScreen={false} />
        )}

        {!isLoading && !error && !hasItems && (
          <EmptyState
            icon="cart-outline"
            title="Your cart is empty"
            message="Browse products to add items to your cart"
          />
        )}

        {hasItems && (
          <>
            {cart!.items.map((item) => (
              <CartItemRow
                key={item.key}
                item={item}
                settings={settings}
                onUpdateQuantity={handleUpdateQuantity}
                onRemove={handleRemoveItem}
                disabled={mutatingKey !== null}
              />
            ))}
            <CartSummary
              totals={cart!.totals}
              coupons={cart!.coupons ?? []}
              fees={cart!.fees ?? []}
              settings={settings}
              onApplyCoupon={handleApplyCoupon}
              onRemoveCoupon={handleRemoveCoupon}
              onClose={closeCart}
              couponLoading={couponLoading}
              couponError={couponError}
            />
          </>
        )}
      </BottomSheetScrollView>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <CartCountContext.Provider value={cartCount}>
      <CartSheetContext.Provider value={useMemo(() => ({ openCart, closeCart }), [openCart, closeCart])}>
        {children}

        <BottomSheet
          visible={sheetVisible}
          onClose={closeCart}
          heightPercentage={75}
          title="Cart"
        >
          {renderSheetContent()}
        </BottomSheet>
      </CartSheetContext.Provider>
    </CartCountContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hooks
// -----------------------------------------------------------------------------

/** Returns the current cart item count. Safe to call outside provider (returns 0). */
export function useCartCount(): number {
  return useContext(CartCountContext);
}

/** Returns openCart/closeCart functions to control the cart bottom sheet. */
export function useCartSheet() {
  return useContext(CartSheetContext);
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  centeredContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
});
