// =============================================================================
// CALENDAR TYPES - TypeScript definitions for calendar/events data
// =============================================================================
// Based on TBC WooCommerce Calendar REST API
// API Base: /wp-json/tbc-wc/v1
// =============================================================================

// -----------------------------------------------------------------------------
// Calendar Event - Main event object from API
// -----------------------------------------------------------------------------

export interface CalendarEvent {
  product_id: number;
  title: string;
  start: string;                    // "YYYY-MM-DD"
  end: string;                      // "YYYY-MM-DD"
  start_time: string | null;        // "HH:MM" 24hr format
  end_time: string | null;          // "HH:MM" 24hr format
  status: EventStatus;
  location: EventLocation | null;
  excerpt: string | null;
  price: string;                    // HTML formatted price
  price_raw: number;
  deposit: number | null;           // Non-refundable deposit amount
  image: string | null;
  categories: string[];             // Category slugs
  tags: string[];                   // Product tag slugs (used for short titles)
  url: string;                      // WebView destination
  recurring_type: 'single' | 'individual' | 'interval';
  calendar_color?: string;          // Hex color for calendar display
  rsvp: EventRSVP | null;
  progress: EventProgress | null;
  user: EventUserStatus | null;     // Only when authenticated
}

// -----------------------------------------------------------------------------
// Event Status
// -----------------------------------------------------------------------------

export type EventStatus = 'open' | 'closed' | 'booked';

// -----------------------------------------------------------------------------
// Event Location
// -----------------------------------------------------------------------------

export interface EventLocation {
  business_name: string | null;
  address: string | null;
}

// -----------------------------------------------------------------------------
// Event RSVP - Deadline tracking
// -----------------------------------------------------------------------------

export interface EventRSVP {
  enabled: boolean;
  deadline: string;                 // "YYYY-MM-DD"
  formatted_deadline: string;       // "January 3, 2026"
  days_remaining: number;
  deadline_passed: boolean;
  show_countdown: boolean;
}

// -----------------------------------------------------------------------------
// Event Progress - Goal tracking
// -----------------------------------------------------------------------------

export interface EventProgress {
  goal_type: 'sales' | 'revenue' | 'subscribers';
  goal: number;
  current: number;
  percentage: number;
  show_percentage: boolean;
  above_text: string | null;
}

// -----------------------------------------------------------------------------
// Event User Status - Current user's relationship to event
// -----------------------------------------------------------------------------

export interface EventUserStatus {
  is_booked: boolean;
  booked_quantity: number | null;
  is_on_waitlist: boolean;
}

// -----------------------------------------------------------------------------
// API Response Types
// -----------------------------------------------------------------------------

export interface EventsResponse {
  events: CalendarEvent[];
  meta: EventsMeta;
}

export interface EventsMeta {
  total: number;
  user_authenticated: boolean;
  filters?: {
    product_id: number | null;
    category: string | null;
    month: string | null;
    limit: number;
  };
}

export interface WaitlistEntry {
  product_id: number;
  title: string;
  start: string;
  end: string;
  date_added: string;
  url: string;
  image: string | null;
}

export interface UserWaitlistResponse {
  waitlist: WaitlistEntry[];
  meta: {
    total: number;
  };
}

export interface WaitlistActionResponse {
  success: boolean;
  message: string;
  data?: {
    product_id: number;
    event_date: string;
  };
}

// -----------------------------------------------------------------------------
// Request Options
// -----------------------------------------------------------------------------

export interface GetEventsOptions {
  month?: string;
  limit?: number;
  category?: string;
  product_id?: number;
}

// -----------------------------------------------------------------------------
// Helper Types for UI
// -----------------------------------------------------------------------------

export interface EventsByDate {
  [date: string]: CalendarEvent[];
}

export type CalendarViewMode = 'list' | 'month';
