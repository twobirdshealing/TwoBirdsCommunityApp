// =============================================================================
// CART CONTEXT - App-wide WooCommerce cart state
// =============================================================================
// Provides cart count and data throughout the app
// =============================================================================

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  ReactNode 
} from 'react';
import { appApi, CartItem } from '@/services/api/app';
import { useAuth } from '@/contexts/AuthContext';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface CartState {
  count: number;
  total: string;
  items: CartItem[];
  cartUrl: string;
  checkoutUrl: string;
  loading: boolean;
}

interface CartContextValue extends CartState {
  refresh: () => Promise<void>;
}

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const CartContext = createContext<CartContextValue | undefined>(undefined);

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const { isAuthenticated } = useAuth();
  
  const [state, setState] = useState<CartState>({
    count: 0,
    total: '0.00',
    items: [],
    cartUrl: '',
    checkoutUrl: '',
    loading: false,
  });

  const refresh = useCallback(async () => {
    console.log('[CartContext] Refreshing cart, authenticated:', isAuthenticated);
    
    if (!isAuthenticated) {
      setState(prev => ({
        ...prev,
        count: 0,
        total: '0.00',
        items: [],
        loading: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true }));
    
    try {
      console.log('[CartContext] Fetching cart from API...');
      const response = await appApi.getCart();
      
      console.log('[CartContext] Cart response:', response);
      
      if (response.success) {
        setState({
          count: response.cart.count,
          total: response.cart.total,
          items: response.cart.items,
          cartUrl: response.cart.cart_url,
          checkoutUrl: response.cart.checkout_url,
          loading: false,
        });
        console.log('[CartContext] Cart updated, count:', response.cart.count);
      }
    } catch (error) {
      console.log('[CartContext] Error fetching cart:', error);
      // Silently fail
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [isAuthenticated]);

  // Fetch on mount and when auth changes
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh periodically (every 60 seconds)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    const interval = setInterval(refresh, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, refresh]);

  return (
    <CartContext.Provider value={{ ...state, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  
  return context;
}

export default CartContext;
