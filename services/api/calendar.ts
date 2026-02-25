// =============================================================================
// CALENDAR API - Events and waitlist endpoints
// =============================================================================
// IMPORTANT: Uses different API namespace than Fluent Community!
// Base: /wp-json/tbc-wc/v1 (NOT /wp-json/fluent-community/v2)
// JWT auth + silent refresh handled automatically by client.ts.
// =============================================================================

import { SITE_URL } from '@/constants/config';
import { request } from './client';
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
// Get User's Waitlist
// -----------------------------------------------------------------------------

export async function getUserWaitlist() {
  return request<UserWaitlistResponse>('/user/waitlist', {
    baseUrl: CALENDAR_API_URL,
  });
}

// -----------------------------------------------------------------------------
// Join Waitlist
// -----------------------------------------------------------------------------

export async function joinWaitlist(productId: number, eventDate: string) {
  return request<WaitlistActionResponse>('/waitlist/join', {
    method: 'POST',
    body: {
      product_id: productId,
      event_date: eventDate,
    },
    baseUrl: CALENDAR_API_URL,
  });
}

// -----------------------------------------------------------------------------
// Leave Waitlist
// -----------------------------------------------------------------------------

export async function leaveWaitlist(productId: number, eventDate: string) {
  return request<WaitlistActionResponse>('/waitlist/leave', {
    method: 'POST',
    body: {
      product_id: productId,
      event_date: eventDate,
    },
    baseUrl: CALENDAR_API_URL,
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
