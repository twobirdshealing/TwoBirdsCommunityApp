// =============================================================================
// API CLIENT - Base HTTP client with dynamic authentication
// =============================================================================
// Uses stored auth token from SecureStore.
// Falls back to hardcoded credentials only if no user is logged in.
// =============================================================================

import { API_URL, API_USERNAME, API_PASSWORD } from '@/constants/config';
import { getBasicAuth } from '@/services/auth';
import { ApiError } from '@/types/api';

// -----------------------------------------------------------------------------
// Debug
// -----------------------------------------------------------------------------

const DEBUG = true;
function log(...args: any[]) {
  if (DEBUG) console.log('[API]', ...args);
}

// -----------------------------------------------------------------------------
// Fallback credentials (for development when not logged in)
// -----------------------------------------------------------------------------

const FALLBACK_CREDENTIALS = btoa(`${API_USERNAME}:${API_PASSWORD}`);

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestConfig {
  method?: HttpMethod;
  body?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: ApiError;
};

// -----------------------------------------------------------------------------
// Get Auth Header
// -----------------------------------------------------------------------------

async function getAuthHeader(): Promise<string> {
  // Try to get stored auth token first
  const storedAuth = await getBasicAuth();
  
  if (storedAuth) {
    log('Using stored auth token');
    return `Basic ${storedAuth}`;
  }
  
  // Fall back to hardcoded credentials (dev mode)
  log('Using fallback credentials - user not logged in');
  return `Basic ${FALLBACK_CREDENTIALS}`;
}

// -----------------------------------------------------------------------------
// Build URL with query parameters
// -----------------------------------------------------------------------------

function buildUrl(endpoint: string, params?: Record<string, any>): string {
  let url = `${API_URL}${endpoint}`;
  
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }
  
  return url;
}

// -----------------------------------------------------------------------------
// Main Request Function
// -----------------------------------------------------------------------------

async function request<T>(endpoint: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
  const { method = 'GET', body, params, headers = {} } = config;
  
  const url = buildUrl(endpoint, params);
  
  log(`${method} ${url}`);
  
  try {
    // Get auth header (uses stored token or fallback)
    const authHeader = await getAuthHeader();
    
    // Make the request
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': authHeader,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('[API Error]', data);
      return {
        success: false,
        error: data as ApiError,
      };
    }
    
    return {
      success: true,
      data: data as T,
    };
    
  } catch (error) {
    console.error('[API Network Error]', error);
    return {
      success: false,
      error: {
        code: 'network_error',
        message: error instanceof Error ? error.message : 'Network request failed',
        data: { status: 0 },
      },
    };
  }
}

// -----------------------------------------------------------------------------
// Convenience Methods (SAME AS ORIGINAL - these are what feeds.ts imports)
// -----------------------------------------------------------------------------

// GET request
export function get<T>(endpoint: string, params?: Record<string, any>) {
  return request<T>(endpoint, { method: 'GET', params });
}

// POST request
export function post<T>(endpoint: string, body?: any, params?: Record<string, any>) {
  return request<T>(endpoint, { method: 'POST', body, params });
}

// PUT request
export function put<T>(endpoint: string, body?: any, params?: Record<string, any>) {
  return request<T>(endpoint, { method: 'PUT', body, params });
}

// DELETE request
export function del<T>(endpoint: string, params?: Record<string, any>) {
  return request<T>(endpoint, { method: 'DELETE', params });
}

// PATCH request
export function patch<T>(endpoint: string, body?: any, params?: Record<string, any>) {
  return request<T>(endpoint, { method: 'PATCH', body, params });
}

// -----------------------------------------------------------------------------
// Export the client object for named import
// -----------------------------------------------------------------------------

export const apiClient = {
  get,
  post,
  put,
  delete: del,
  patch,
  request,
};

export default apiClient;
