// =============================================================================
// API CLIENT - Base HTTP client with authentication
// =============================================================================
// This is the foundation of all API calls. It handles:
//   - Adding authentication headers
//   - Making HTTP requests
//   - Parsing responses
//   - Error handling
//
// All other API services (feeds.ts, spaces.ts, etc.) use this client.
// =============================================================================

import { API_URL, API_USERNAME, API_PASSWORD } from '@/constants/config';
import { ApiError } from '@/types/api';

// -----------------------------------------------------------------------------
// Create Base64 credentials for Basic Auth
// -----------------------------------------------------------------------------

// btoa() converts "username:password" to Base64
// This is how HTTP Basic Authentication works
const credentials = btoa(`${API_USERNAME}:${API_PASSWORD}`);

// -----------------------------------------------------------------------------
// HTTP Methods
// -----------------------------------------------------------------------------

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// -----------------------------------------------------------------------------
// Request Options
// -----------------------------------------------------------------------------

interface RequestConfig {
  method?: HttpMethod;
  body?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

// -----------------------------------------------------------------------------
// API Response Type
// -----------------------------------------------------------------------------

type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: ApiError;
};

// -----------------------------------------------------------------------------
// Build URL with query parameters
// -----------------------------------------------------------------------------

function buildUrl(endpoint: string, params?: Record<string, any>): string {
  // Start with base URL + endpoint
  let url = `${API_URL}${endpoint}`;
  
  // Add query parameters if provided
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      // Skip undefined/null values
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
  
  // Build the full URL with query params
  const url = buildUrl(endpoint, params);
  
  // Log for debugging (remove in production)
  console.log(`[API] ${method} ${url}`);
  
  try {
    // Make the fetch request
    const response = await fetch(url, {
      method,
      headers: {
        // Always include auth header
        'Authorization': `Basic ${credentials}`,
        // Include Content-Type for requests with body
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        // Any additional headers
        ...headers,
      },
      // Convert body to JSON string if provided
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    
    // Parse the JSON response
    const data = await response.json();
    
    // Check if the request was successful
    if (!response.ok) {
      // API returned an error
      console.error('[API Error]', data);
      return {
        success: false,
        error: data as ApiError,
      };
    }
    
    // Success!
    return {
      success: true,
      data: data as T,
    };
    
  } catch (error) {
    // Network error or JSON parsing error
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
// Convenience Methods
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
