// =============================================================================
// API CLIENT - Base HTTP client with dynamic authentication
// =============================================================================
// DEBUG VERSION - Added extensive logging to trace 401 issue
// =============================================================================

import { API_URL } from '@/constants/config';
import { clearAuth, getBasicAuth } from '@/services/auth';
import { ApiError } from '@/types/api';

// -----------------------------------------------------------------------------
// Debug - ENABLED
// -----------------------------------------------------------------------------

const DEBUG = true;
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
  const storedAuth = await getBasicAuth();

  if (storedAuth) {
    log('Retrieved auth token');
    log('FULL TOKEN:', storedAuth);  // ADD THIS LINE TEMPORARILY
    // DEBUG: Log first/last few chars of token (safe to show)
    const tokenPreview = storedAuth.length > 10 
      ? `${storedAuth.substring(0, 5)}...${storedAuth.substring(storedAuth.length - 5)}`
      : '[short token]';
    log('Token preview:', tokenPreview);
    log('Token length:', storedAuth.length);
    return `Basic ${storedAuth}`;
  }

  log('NO AUTH TOKEN FOUND!');
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
    
    // DEBUG: Log if auth header is present
    log('Auth header present:', !!authHeader);
    if (authHeader) {
      log('Auth header format check:', authHeader.startsWith('Basic ') ? 'OK (starts with Basic)' : 'WRONG FORMAT');
    }

    const requestHeaders: Record<string, string> = {
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    };
    
    // DEBUG: Log all headers being sent (redact auth value)
    const safeHeaders = { ...requestHeaders };
    if (safeHeaders.Authorization) {
      safeHeaders.Authorization = safeHeaders.Authorization.substring(0, 15) + '...';
    }
    log('Request headers:', JSON.stringify(safeHeaders));

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    // DEBUG: Log response status
    log('Response status:', response.status);
    log('Response ok:', response.ok);

    const data = await response.json();

    if (!response.ok) {
      console.error('[API Error]', data);
      
      // DEBUG: Log full error details
      log('ERROR Response data:', JSON.stringify(data, null, 2).substring(0, 500));

      // HARD FAIL AUTH ON INVALID APP PASSWORD
      if (
        response.status === 401 &&
        data?.code === 'incorrect_password'
      ) {
        console.warn('[Auth] Invalid application password — clearing auth');
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
// Convenience Methods
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
