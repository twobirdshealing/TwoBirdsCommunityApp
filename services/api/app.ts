// =============================================================================
// APP API SERVICE - TBC Community App specific endpoints
// =============================================================================
// Handles: Web sessions (for WebView auth), Cart info
// Base: /wp-json/tbc-ca/v1
// =============================================================================

import { SITE_URL } from '@/constants/config';
import { getBasicAuth } from '@/services/auth';

const APP_API_URL = `${SITE_URL}/wp-json/tbc-ca/v1`;

// -----------------------------------------------------------------------------
// Debug Logging
// -----------------------------------------------------------------------------

const DEBUG = true;
function log(...args: any[]) {
  if (DEBUG) console.log('[AppAPI]', ...args);
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface WebSessionResponse {
  success: boolean;
  url: string;
  expires_in: number;
}

export interface CartItem {
  key: string;
  product_id: number;
  name: string;
  quantity: number;
  price: string;
  image: string | null;
}

export interface CartResponse {
  success: boolean;
  cart: {
    count: number;
    total: string;
    items: CartItem[];
    cart_url: string;
    checkout_url: string;
  };
}

// -----------------------------------------------------------------------------
// API Helper
// -----------------------------------------------------------------------------

async function appRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST';
    body?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const { method = 'GET', body } = options;
  
  const url = `${APP_API_URL}${endpoint}`;
  log(`${method} ${url}`);
  
  const basicAuth = await getBasicAuth();
  
  if (!basicAuth) {
    log('ERROR: No auth token available');
    throw new Error('Not authenticated');
  }
  
  log('Auth token retrieved, length:', basicAuth.length);
  
  const headers: HeadersInit = {
    'Authorization': `Basic ${basicAuth}`,
    'Content-Type': 'application/json',
  };
  
  const config: RequestInit = {
    method,
    headers,
  };
  
  if (body && method === 'POST') {
    config.body = JSON.stringify(body);
    log('Request body:', JSON.stringify(body));
  }
  
  try {
    log('Sending request...');
    const response = await fetch(url, config);
    
    log('Response status:', response.status);
    
    const responseText = await response.text();
    log('Response text:', responseText.substring(0, 500));
    
    if (!response.ok) {
      let errorMessage = `Request failed: ${response.status}`;
      try {
        const errorData = JSON.parse(responseText);
        errorMessage = errorData.message || errorMessage;
        log('Error data:', errorData);
      } catch {
        log('Could not parse error response');
      }
      throw new Error(errorMessage);
    }
    
    // Parse successful response
    const data = JSON.parse(responseText);
    log('Success:', JSON.stringify(data).substring(0, 200));
    return data;
  } catch (error) {
    log('Request error:', error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Web Session (for WebView authentication)
// -----------------------------------------------------------------------------

/**
 * Create a one-time login URL for WebView
 * Opens the URL in WebView to automatically log user in
 * 
 * @param redirectUrl - Where to redirect after login (e.g., event URL)
 * @returns Promise with the auto-login URL
 */
export async function createWebSession(redirectUrl: string): Promise<WebSessionResponse> {
  return appRequest<WebSessionResponse>('/create-web-session', {
    method: 'POST',
    body: { redirect_url: redirectUrl },
  });
}

// -----------------------------------------------------------------------------
// Cart
// -----------------------------------------------------------------------------

/**
 * Get current user's WooCommerce cart info
 * Used to show cart badge count in the app
 * 
 * @returns Promise with cart data
 */
export async function getCart(): Promise<CartResponse> {
  return appRequest<CartResponse>('/cart');
}

// -----------------------------------------------------------------------------
// Exports
// -----------------------------------------------------------------------------

export const appApi = {
  createWebSession,
  getCart,
};

export default appApi;
