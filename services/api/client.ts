// =============================================================================
// API CLIENT - Base HTTP client with JWT authentication
// =============================================================================
// Uses stored JWT token from SecureStore.
// All requests use Bearer token authentication.
// =============================================================================

import { API_URL } from '@/constants/config';
import { clearAuth, getAuthToken, silentRefresh } from '@/services/auth';
import { ApiError } from '@/types/api';
import { createLogger } from '@/utils/logger';
import NetInfo from '@react-native-community/netinfo';

const log = createLogger('API');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface RequestConfig {
  method?: HttpMethod;
  body?: any; // eslint-disable-line @typescript-eslint/no-explicit-any -- accepts JSON, FormData, etc.
  params?: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any -- query params
  headers?: Record<string, string>;
  /** Override the base URL (defaults to Fluent Community API_URL) */
  baseUrl?: string;
  /** When true, body is sent as-is (e.g. FormData) instead of JSON.stringify */
  rawBody?: boolean;
  /** When true, response Headers object is included in the success result */
  includeHeaders?: boolean;
  /** @internal Used to prevent infinite retry loops */
  _isRetry?: boolean;
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError };

export type ApiResponseWithHeaders<T> =
  | { success: true; data: T; headers: Headers }
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

function buildUrl(endpoint: string, params?: Record<string, any>, baseUrl?: string): string {
  let url = `${baseUrl || API_URL}${endpoint}`;

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
): Promise<ApiResponse<T> | ApiResponseWithHeaders<T>> {
  const { method = 'GET', body, params, headers = {}, baseUrl, rawBody, includeHeaders } = config;

  const url = buildUrl(endpoint, params, baseUrl);
  log(`${method} ${url}`);

  // Pre-flight connectivity check — fail fast instead of waiting for fetch timeout
  try {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      return {
        success: false,
        error: {
          code: 'network_error',
          message: 'No internet connection',
          data: { status: 0 },
        },
      };
    }
  } catch {
    // NetInfo failed — proceed with fetch anyway (let fetch handle the error)
  }

  try {
    const authHeader = await getAuthHeader();

    // Build headers — skip Content-Type for raw bodies (e.g. FormData sets its own)
    const isRaw = rawBody && body;
    const requestHeaders: Record<string, string> = {
      'Accept': 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(!isRaw && body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    };

    // Debug: Log headers (without full token)
    if (__DEV__) {
      const debugHeaders = { ...requestHeaders };
      if (debugHeaders.Authorization) {
        debugHeaders.Authorization = debugHeaders.Authorization.substring(0, 30) + '...';
      }
      log('Request headers:', JSON.stringify(debugHeaders, null, 2));
    }

    if (__DEV__ && body && !isRaw) {
      log('Request body (preview):', JSON.stringify(body).substring(0, 500));
    }

    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      ...(body ? { body: isRaw ? body : JSON.stringify(body) } : {}),
    });

    // Debug: Log response status
    log('Response status:', response.status, response.statusText);

    const data = await response.json();

    // Debug: Log first 500 chars of response
    if (__DEV__) {
      log('Response data (preview):', JSON.stringify(data).substring(0, 500));
    }

    if (!response.ok) {
      if (response.status >= 500) {
        console.error('[API Error]', data);
      } else {
        console.warn('[API Error]', data);
      }

      // Handle JWT expiration or invalid token
      const isJwtExpired = (
        response.status === 401 ||
        (response.status === 403 &&
          (data?.code === 'jwt_auth_invalid_token' ||
           data?.code === 'jwt_auth_expired_token' ||
           data?.code === 'rest_forbidden'))
      );

      if (isJwtExpired && !config._isRetry) {
        log('JWT expired, attempting silent refresh...');
        const refreshed = await silentRefresh();

        if (refreshed) {
          log('Token refreshed, retrying request...');
          return request<T>(endpoint, { ...config, _isRetry: true });
        }

        console.warn('[Auth] Silent refresh failed — clearing auth');
        await clearAuth();
      } else if (isJwtExpired && config._isRetry) {
        console.warn('[Auth] JWT still invalid after refresh — clearing auth');
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
      ...(includeHeaders ? { headers: response.headers } : {}),
    } as ApiResponse<T> | ApiResponseWithHeaders<T>;
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
  params?: Record<string, any>,
  headers?: Record<string, string>
) {
  return request<T>(endpoint, { method: 'POST', body, params, headers });
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
// Direct request access (for services needing baseUrl, rawBody, or headers)
// -----------------------------------------------------------------------------

export { request };

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