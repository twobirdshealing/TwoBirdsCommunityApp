// =============================================================================
// CART TYPES — Response shapes from tbc-cart REST API
// =============================================================================

export interface CartItem {
  key: string;
  product_id: number;
  variation_id: number;
  name: string;
  price: string;
  quantity: number;
  subtotal: string;
  image: string | null;
  variation: Record<string, string>;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  max_quantity: number | null;
}

export interface CartCoupon {
  code: string;
  discount: string;
  label: string;
}

export interface CartFee {
  name: string;
  amount: string;
  tax: string;
}

export interface CartTotals {
  subtotal: string;
  discount: string;
  shipping: string;
  fee: string;
  tax: string;
  total: string;
  currency: string;
  item_count: number;
}

export interface CartSettings {
  coupons_enabled: boolean;
  tax_enabled: boolean;
  shipping_enabled: boolean;
  currency_symbol: string;
  currency_position: 'left' | 'right' | 'left_space' | 'right_space';
  price_decimals: number;
}

export interface CartData {
  items: CartItem[];
  coupons: CartCoupon[];
  fees: CartFee[];
  totals: CartTotals;
  settings: CartSettings;
}
