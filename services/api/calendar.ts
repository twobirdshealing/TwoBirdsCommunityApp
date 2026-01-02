// =============================================================================
// CALENDAR API - Events and waitlist endpoints
// =============================================================================
// IMPORTANT: Uses different API namespace than Fluent Community!
// Base: /wp-json/tbc-wc/v1 (NOT /wp-json/fluent-community/v2)
// Uses JWT Bearer token authentication
// =============================================================================

import { SITE_URL } from '@/constants/config';
import { getAuthToken } from '@/services/auth';
import {
  EventsResponse,
  GetEventsOptions,
  UserWaitlistResponse,
  WaitlistActionResponse
} from '@/types/calendar';

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const CALENDAR_API_URL = `${SITE_URL}/wp-json/tbc-wc/v1`;

const DEBUG = __DEV__;
function log(...args: any[]) {
  if (DEBUG) console.log('[CalendarAPI]', ...args);
}

// -----------------------------------------------------------------------------
// API Helper (separate from main client due to different base URL)
// -----------------------------------------------------------------------------

type ApiResponse<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      error: {
        code: string;
        message: string;
      };
    };


async function calendarRequest<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST';
    body?: any;
    params?: Record<string, any>;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, params } = options;

  // Build URL with params
  let url = `${CALENDAR_API_URL}${endpoint}`;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    url += `?${searchParams.toString()}`;
  }

  // Get auth token and build headers
  const authToken = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  log(`${method} ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers,
      ...(body && { body: JSON.stringify(body) }),
    });

    const data = await response.json();

    if (!response.ok) {
      log('Error response:', data);
      return {
        success: false,
        error: {
          code: data.code || 'unknown_error',
          message: data.message || 'An error occurred',
        },
      };
    }

    return { success: true, data };
  } catch (error) {
    log('Request failed:', error);
    return {
      success: false,
      error: {
        code: 'network_error',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

// -----------------------------------------------------------------------------
// Get Events
// -----------------------------------------------------------------------------

export async function getEvents(options: GetEventsOptions = {}) {
  const params: Record<string, any> = {};

  if (options.month) params.month = options.month;
  if (options.limit) params.limit = options.limit;
  if (options.category) params.category = options.category;
  if (options.product_id) params.product_id = options.product_id;

  return calendarRequest<EventsResponse>('/events', { params });
}

// -----------------------------------------------------------------------------
// Get Featured Events
// -----------------------------------------------------------------------------

export async function getFeaturedEvents(limit: number = 3) {
  return calendarRequest<EventsResponse>('/events/featured', {
    params: { limit },
  });
}

// -----------------------------------------------------------------------------
// Get User's Waitlist
// -----------------------------------------------------------------------------

export async function getUserWaitlist() {
  return calendarRequest<UserWaitlistResponse>('/user/waitlist');
}

// -----------------------------------------------------------------------------
// Join Waitlist
// -----------------------------------------------------------------------------

export async function joinWaitlist(productId: number, eventDate: string) {
  return calendarRequest<WaitlistActionResponse>('/waitlist/join', {
    method: 'POST',
    body: {
      product_id: productId,
      event_date: eventDate,
    },
  });
}

// -----------------------------------------------------------------------------
// Leave Waitlist
// -----------------------------------------------------------------------------

export async function leaveWaitlist(productId: number, eventDate: string) {
  return calendarRequest<WaitlistActionResponse>('/waitlist/leave', {
    method: 'POST',
    body: {
      product_id: productId,
      event_date: eventDate,
    },
  });
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const calendarApi = {
  getEvents,
  getFeaturedEvents,
  getUserWaitlist,
  joinWaitlist,
  leaveWaitlist,
};

export default calendarApi;