// =============================================================================
// CART API SERVICE — REST endpoints for the native cart screen
// =============================================================================

import { request } from '@/services/api/client';
import { SITE_URL } from '@/constants/config';
import type { CartData } from '../types';

const API_BASE = `${SITE_URL}/wp-json/tbc-cart/v1`;

/** Fetch full cart contents, totals, coupons, and WC settings. */
export async function getCart() {
  return request<CartData>('/cart', { baseUrl: API_BASE });
}

/** Update the quantity of a cart item. Returns full updated cart. */
export async function updateQuantity(key: string, quantity: number) {
  return request<CartData>(`/cart/items/${key}`, {
    baseUrl: API_BASE,
    method: 'PATCH',
    body: { quantity },
  });
}

/** Remove an item from the cart. Returns full updated cart. */
export async function removeItem(key: string) {
  return request<CartData>(`/cart/items/${key}`, {
    baseUrl: API_BASE,
    method: 'DELETE',
  });
}

/** Apply a coupon code. Returns full updated cart. */
export async function applyCoupon(code: string) {
  return request<CartData>('/cart/coupons', {
    baseUrl: API_BASE,
    method: 'POST',
    body: { code },
  });
}

/** Remove a coupon code. Returns full updated cart. */
export async function removeCoupon(code: string) {
  return request<CartData>(`/cart/coupons/${code}`, {
    baseUrl: API_BASE,
    method: 'DELETE',
  });
}

export const cartApi = { getCart, updateQuantity, removeItem, applyCoupon, removeCoupon };
