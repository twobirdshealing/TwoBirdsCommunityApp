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

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
  const hasOpenedRef = useRef(false);

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
    isRefreshing,
    error,
    refresh,
    mutate,
  } = useAppQuery<CartData>({
    cacheKey: 'tbc_cart',
    fetcher: async () => {
      log('Fetching cart...');
      const result = await cartApi.getCart();
      log('Cart result:', result.success ? `${result.data.items.length} items` : `error: ${result.error?.message}`);
      if (!result.success) throw new Error(result.error?.message || 'Failed to load cart');
      return result.data;
    },
    enabled: hasOpened,
  });

  // -------------------------------------------------------------------------
  // Sheet controls
  // -------------------------------------------------------------------------

  const openCart = useCallback(() => {
    log('Opening cart sheet');
    setSheetVisible(true);
    if (hasOpenedRef.current) {
      // Defer to next tick — bundling the refetch with setSheetVisible into
      // one React commit caused an iPad-only present()/render race.
      setTimeout(refresh, 0);
    } else {
      // Ref + state both intentional: ref for synchronous read in this
      // callback, state for `enabled` gating in useAppQuery below.
      hasOpenedRef.current = true;
      setHasOpened(true);
    }
  }, [refresh]);

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
      } else {
        const errorData = result.error?.data as any;
        setCouponError(errorData?.message || result.error?.message || 'Could not apply coupon');
        if (errorData?.cart) mutate(errorData.cart);
        return false;
      }
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
  // Uses BottomSheetScrollView (not BottomSheetFlatList) to avoid an iOS-only
  // crash on iPad. BottomSheetFlatList registers itself as a scrollable with
  // gorhom's gesture system on mount; when the FlatList renders in the same
  // React commit as the modal present() (which happens on the 2nd cart open
  // because TanStack Query's cached data skips the isLoading branch), UIKit
  // hits a view-tree commit assertion → NSException → SIGABRT.
  // Carts are size-bounded (typically <20 items), so virtualization gives no
  // real benefit and ScrollView is the right tool here.
  // -------------------------------------------------------------------------

  const renderSheetContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      );
    }

    if (error && !cart) {
      return (
        <View style={styles.centered}>
          <ErrorMessage message={error.message} onRetry={refresh} />
        </View>
      );
    }

    if (!cart || cart.items.length === 0) {
      return (
        <View style={styles.centered}>
          <EmptyState
            icon="cart-outline"
            title="Your cart is empty"
            message="Browse products to add items to your cart"
          />
        </View>
      );
    }

    const settings = cart.settings ?? DEFAULT_SETTINGS;

    return (
      <BottomSheetScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {cart.items.map((item) => (
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
          totals={cart.totals}
          coupons={cart.coupons ?? []}
          fees={cart.fees ?? []}
          settings={settings}
          onApplyCoupon={handleApplyCoupon}
          onRemoveCoupon={handleRemoveCoupon}
          onClose={closeCart}
          couponLoading={couponLoading}
          couponError={couponError}
        />
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
});
