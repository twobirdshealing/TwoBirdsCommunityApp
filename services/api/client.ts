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
import type { ResponseHeaderMapping } from '@/modules/_types';
import NetInfo from '@react-native-community/netinfo';

const log = createLogger('API');

// -----------------------------------------------------------------------------
// Response Header Listeners (non-React → React bridge)
// -----------------------------------------------------------------------------
// Multiple listeners can subscribe to process custom response headers from
// every authenticated API response. _layout.tsx registers the core listener;
// modules can add their own via addResponseHeaderListener.

const CORE_HEADERS = {
  UNREAD_NOTIFICATIONS: 'X-TBC-Unread-Notifications',
  UNREAD_MESSAGES: 'X-TBC-Unread-Messages',
  MAINTENANCE: 'X-TBC-Maintenance',
  MIN_APP_VERSION: 'X-TBC-Min-App-Version',
} as const;

export interface ResponseHeaderData {
  unreadNotifications?: number;
  unreadMessages?: number;
  maintenance?: boolean;
  minAppVersion?: string;
  /** Module-injected header values (keyed by ResponseHeaderMapping.key) */
  [key: string]: any;
}

type ResponseHeaderListener = (data: ResponseHeaderData) => void;
const responseHeaderListeners = new Set<ResponseHeaderListener>();

// Module response headers — registered by _registry.ts to avoid circular imports
let _moduleResponseHeaders: ResponseHeaderMapping[] = [];

/** Called by modules/_registry.ts to push header mappings into the client */
export function registerModuleResponseHeaders(headers: ResponseHeaderMapping[]): void {
  _moduleResponseHeaders = headers;
}

/** Subscribe to response header updates. Returns an unsubscribe function. */
export function addResponseHeaderListener(listener: ResponseHeaderListener): () => void {
  responseHeaderListeners.add(listener);
  return () => responseHeaderListeners.delete(listener);
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/** Default request timeout in milliseconds (20 seconds) */
const DEFAULT_TIMEOUT_MS = 20_000;

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
  /** Request timeout in milliseconds (default: 20000) */
  timeout?: number;
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
    log.debug('Using JWT token', { hasToken: true });
    return `Bearer ${token}`;
  }

  log.warn('No auth token available');
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
// Normalize API Error Responses
// -----------------------------------------------------------------------------
// WordPress / Fluent Community returns errors in several shapes:
//   1. { message: "string" }                          — sendError()
//   2. { message: ["string", ...] }                   — ValidationException
//   3. { code: "x", message: "y", data: { status } } — WP_Error / REST
//   4. "plain string" / null                          — rare edge cases

function normalizeApiError(data: unknown, statusCode: number): ApiError {
  if (data == null || typeof data !== 'object') {
    return {
      code: 'error',
      message: typeof data === 'string' ? data : 'An unknown error occurred',
      data: { status: statusCode, raw: data },
    };
  }

  const obj = data as Record<string, unknown>;

  // Extract message — handle string, array, or missing
  let message: string;
  const rawMessage = obj.message;

  if (typeof rawMessage === 'string') {
    message = rawMessage;
  } else if (Array.isArray(rawMessage)) {
    message = rawMessage.filter(m => typeof m === 'string').join('. ') || 'Validation failed';
  } else if (rawMessage && typeof rawMessage === 'object') {
    // Nested validation errors: { field: ["error1", "error2"] }
    const flat = Object.values(rawMessage as Record<string, unknown>).flatMap(v =>
      Array.isArray(v) ? v : [v]
    );
    message = flat.filter(m => typeof m === 'string').join('. ') || 'An error occurred';
  } else {
    message = typeof obj.error === 'string' ? obj.error : 'An error occurred';
  }

  const nestedData =
    obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : null;

  return {
    code: typeof obj.code === 'string' ? obj.code : 'error',
    message,
    data: {
      status: typeof nestedData?.status === 'number' ? nestedData.status : statusCode,
      raw: data,
    },
  };
}

// -----------------------------------------------------------------------------
// Main Request Function
// -----------------------------------------------------------------------------

async function request<T>(
  endpoint: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T> | ApiResponseWithHeaders<T>> {
  const { method = 'GET', body, params, headers = {}, baseUrl, rawBody, includeHeaders, timeout = DEFAULT_TIMEOUT_MS } = config;

  const url = buildUrl(endpoint, params, baseUrl);
  log.debug('request', { method, url });

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

    // Debug: Log headers (Authorization is redacted — never log token bytes)
    if (__DEV__) {
      const debugHeaders = { ...requestHeaders };
      if (debugHeaders.Authorization) {
        debugHeaders.Authorization = 'Bearer [REDACTED]';
      }
      log.debug('Request headers', { headers: debugHeaders });
    }

    if (__DEV__ && body && !isRaw) {
      log.debug('Request body preview', { body: JSON.stringify(body).substring(0, 500) });
    }

    // Set up request timeout via AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: requestHeaders,
        signal: controller.signal,
        ...(body ? { body: isRaw ? body : JSON.stringify(body) } : {}),
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // Debug: Log response status
    log.debug('Response status:', { status: response.status, statusText: response.statusText });

    // Parse JSON — handle non-JSON responses (e.g. HTML from 502 proxy errors)
    let data: any;
    try {
      data = await response.json();
    } catch {
      const text = await response.text().catch(() => '');
      log.warn('Failed to parse JSON response', { status: response.status, bodyPreview: text.substring(0, 200) });
      return {
        success: false,
        error: {
          code: 'parse_error',
          message: `Server returned invalid JSON (HTTP ${response.status})`,
          data: { status: response.status },
        },
      };
    }

    // Debug: Log first 500 chars of response
    if (__DEV__) {
      log.debug('Response data preview', { data: JSON.stringify(data).substring(0, 500) });
    }

    // Extract custom response headers (unread counts, maintenance, min version, module headers)
    if (responseHeaderListeners.size > 0) {
      const hNotif = response.headers.get(CORE_HEADERS.UNREAD_NOTIFICATIONS);
      const hMsg = response.headers.get(CORE_HEADERS.UNREAD_MESSAGES);
      const hMaint = response.headers.get(CORE_HEADERS.MAINTENANCE);
      const hMinVer = response.headers.get(CORE_HEADERS.MIN_APP_VERSION);

      // Module-registered headers (extracted generically via manifest)
      const moduleHeaders = _moduleResponseHeaders;
      const moduleData: Record<string, any> = {};
      let hasModuleHeader = false;
      for (const mapping of moduleHeaders) {
        const value = response.headers.get(mapping.header);
        if (value !== null) {
          moduleData[mapping.key] = mapping.transform ? mapping.transform(value) : value;
          hasModuleHeader = true;
        }
      }

      if (hNotif !== null || hMsg !== null || hMaint !== null || hMinVer !== null || hasModuleHeader) {
        const nNotif = hNotif !== null ? parseInt(hNotif, 10) : NaN;
        const nMsg = hMsg !== null ? parseInt(hMsg, 10) : NaN;
        const headerData: ResponseHeaderData = {
          ...(!isNaN(nNotif) && nNotif >= 0 && { unreadNotifications: nNotif }),
          ...(!isNaN(nMsg) && nMsg >= 0 && { unreadMessages: nMsg }),
          ...(hMaint !== null && { maintenance: hMaint === '1' }),
          ...(hMinVer !== null && { minAppVersion: hMinVer }),
          ...moduleData,
        };
        for (const listener of responseHeaderListeners) {
          listener(headerData);
        }
      }
    }

    if (!response.ok) {
      if (response.status >= 500) {
        log.error(new Error(`HTTP ${response.status}`), 'Server error', { status: response.status, data });
      } else {
        log.warn('HTTP error', { status: response.status, data });
      }

      // Handle JWT expiration or invalid token
      const isJwtExpired = (
        response.status === 401 ||
        (response.status === 403 &&
          (data?.code === 'tbc_auth_expired_token' ||
           data?.code === 'tbc_auth_revoked_session' ||
           data?.code === 'tbc_auth_bad_token' ||
           data?.code === 'rest_forbidden'))
      );

      if (isJwtExpired && !config._isRetry) {
        log.debug('JWT expired, attempting silent refresh...');
        const refreshed = await silentRefresh();

        if (refreshed) {
          log.debug('Token refreshed, retrying request...');
          return request<T>(endpoint, { ...config, _isRetry: true });
        }

        log.warn('Silent refresh failed — clearing auth');
        await clearAuth();
      } else if (isJwtExpired && config._isRetry) {
        log.warn('JWT still invalid after refresh — clearing auth');
        await clearAuth();
      }

      return {
        success: false,
        error: normalizeApiError(data, response.status),
      };
    }

    return {
      success: true,
      data: data as T,
      ...(includeHeaders ? { headers: response.headers } : {}),
    } as ApiResponse<T> | ApiResponseWithHeaders<T>;
  } catch (error) {
    // Distinguish timeout from other network errors
    if (error instanceof Error && error.name === 'AbortError') {
      log.warn('Request timed out:', { url });
      return {
        success: false,
        error: {
          code: 'timeout',
          message: 'Request timed out — the server took too long to respond',
          data: { status: 0 },
        },
      };
    }

    log.error(error, 'Network error');

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