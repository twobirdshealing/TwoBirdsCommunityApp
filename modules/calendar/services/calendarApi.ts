// =============================================================================
// CALENDAR API - Events and waitlist endpoints
// =============================================================================
// IMPORTANT: Uses different API namespace than Fluent Community!
// Base: /wp-json/tbc-wc/v1 (NOT /wp-json/fluent-community/v2)
// JWT auth + silent refresh handled automatically by client.ts.
// =============================================================================

import { SITE_URL } from '@/constants/config';
import { request } from '@/services/api/client';
import {
  EventsResponse,
  GetEventsOptions,
  UserWaitlistResponse,
} from '@/modules/calendar/types/calendar';

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

const CALENDAR_API_URL = `${SITE_URL}/wp-json/tbc-wc/v1`;

// -----------------------------------------------------------------------------
// Get Events
// -----------------------------------------------------------------------------

export async function getEvents(options: GetEventsOptions = {}) {
  const params: Record<string, any> = {};

  if (options.month) params.month = options.month;
  if (options.limit) params.limit = options.limit;
  if (options.category) params.category = options.category;
  if (options.product_id) params.product_id = options.product_id;

  return request<EventsResponse>('/events', {
    params,
    baseUrl: CALENDAR_API_URL,
  });
}

// -----------------------------------------------------------------------------
// Get Featured Events
// -----------------------------------------------------------------------------

export async function getFeaturedEvents(limit: number = 3) {
  return request<EventsResponse>('/events/featured', {
    params: { limit },
    baseUrl: CALENDAR_API_URL,
  });
}

// -----------------------------------------------------------------------------
// Get User's Booked Events
// -----------------------------------------------------------------------------

export async function getUserBooked(limit: number = 1) {
  return request<EventsResponse>('/user/booked', {
    params: { limit },
    baseUrl: CALENDAR_API_URL,
  });
}

// -----------------------------------------------------------------------------
// Get User's Waitlist
// -----------------------------------------------------------------------------

export async function getUserWaitlist() {
  return request<UserWaitlistResponse>('/user/waitlist', {
    baseUrl: CALENDAR_API_URL,
  });
}

// -----------------------------------------------------------------------------
// Export as object
// -----------------------------------------------------------------------------

export const calendarApi = {
  getEvents,
  getFeaturedEvents,
  getUserBooked,
  getUserWaitlist,
};

export default calendarApi;
