// =============================================================================
// API CLIENT - Base HTTP client with JWT authentication
// =============================================================================
// Uses stored JWT token from SecureStore.
// All requests use Bearer token authentication.
// =============================================================================

import { API_URL } from '@/constants/config';
import { clearAuth, getAuthToken } from '@/services/auth';
import { ApiError } from '@/types/api';

// -----------------------------------------------------------------------------
// Debug
// -----------------------------------------------------------------------------

const DEBUG = __DEV__;
function log(...args: any[]) {
  if (DEBUG) console.log('[API]', ...args);
}

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

type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

// -----------------------------------------------------------------------------
// Get Auth Header
// -----------------------------------------------------------------------------

async function getAuthHeader(): Promise<string | null> {
  const token = await getAuthToken();

  if (token) {
    log('Using JWT token');
    log('Token (first 20 chars):', token.substring(0, 20) + '...');
    return `Bearer ${token}`;
  }

  log('WARNING: No auth token available!');
  return null;
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

async function request<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, params, headers = {} } = config;

  const url = buildUrl(endpoint, params);
  log(`${method} ${url}`);

  try {
    const authHeader = await getAuthHeader();

    // Build headers
    const requestHeaders: Record<string, string> = {
      'Accept': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    };

    // Debug: Log headers (without full token)
    if (DEBUG) {
      const debugHeaders = { ...requestHeaders };
      if (debugHeaders.Authorization) {
        debugHeaders.Authorization = debugHeaders.Authorization.substring(0, 30) + '...';
      }
      log('Request headers:', JSON.stringify(debugHeaders, null, 2));
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    // Debug: Log response status
    log('Response status:', response.status, response.statusText);

    const data = await response.json();

    // Debug: Log first 500 chars of response
    if (DEBUG) {
      log('Response data (preview):', JSON.stringify(data).substring(0, 500));
    }

    if (!response.ok) {
      console.error('[API Error]', data);

      // Handle JWT expiration or invalid token
      if (
        response.status === 401 ||
        response.status === 403 &&
        (data?.code === 'jwt_auth_invalid_token' ||
         data?.code === 'jwt_auth_expired_token' ||
         data?.code === 'rest_forbidden')
      ) {
        console.warn('[Auth] JWT invalid or expired — clearing auth');
        await clearAuth();
      }

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
        message:
          error instanceof Error
            ? error.message
            : 'Network request failed',
        data: { status: 0 },
      },
    };
  }
}

// -----------------------------------------------------------------------------
// Convenience Methods (unchanged public API)
// -----------------------------------------------------------------------------

export function get<T>(endpoint: string, params?: Record<string, any>) {
  return request<T>(endpoint, { method: 'GET', params });
}

export function post<T>(
  endpoint: string,
  body?: any,
  params?: Record<string, any>
) {
  return request<T>(endpoint, { method: 'POST', body, params });
}

export function put<T>(
  endpoint: string,
  body?: any,
  params?: Record<string, any>
) {
  return request<T>(endpoint, { method: 'PUT', body, params });
}

export function del<T>(endpoint: string, params?: Record<string, any>) {
  return request<T>(endpoint, { method: 'DELETE', params });
}

export function patch<T>(
  endpoint: string,
  body?: any,
  params?: Record<string, any>
) {
  return request<T>(endpoint, { method: 'PATCH', body, params });
}

// -----------------------------------------------------------------------------
// Export client
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