# TBC WooCommerce Calendar REST API

**Version:** 1.0.0  
**Base URL:** `https://community.twobirdschurch.com/wp-json/tbc-wc/v1`  
**Staging URL:** `https://staging.twobirdschurch.com/wp-json/tbc-wc/v1`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Endpoints Overview](#endpoints-overview)
3. [Events Endpoints](#events-endpoints)
   - [GET /events](#get-events)
   - [GET /events/featured](#get-eventsfeatured)
4. [Waitlist Endpoints](#waitlist-endpoints)
   - [GET /user/waitlist](#get-userwaitlist)
   - [POST /waitlist/join](#post-waitlistjoin)
   - [POST /waitlist/leave](#post-waitlistleave)
5. [Response Objects](#response-objects)
6. [Error Handling](#error-handling)
7. [Usage Examples](#usage-examples)

---

## Authentication

The API supports both authenticated and unauthenticated requests.

### Unauthenticated Requests
- Available for: `GET /events`, `GET /events/featured`
- User-specific data (`user` object) will be `null`
- `user_authenticated` in meta will be `false`

### Authenticated Requests
- **Required for:** All `/waitlist/*` and `/user/*` endpoints
- **Method:** HTTP Basic Authentication with WordPress Application Passwords
- User-specific data will be populated (booking status, waitlist status)

### Authentication Header

```
Authorization: Basic {base64_encoded_credentials}
```

Where `{base64_encoded_credentials}` is `base64(username:application_password)`

### Example (curl)

```bash
# Using -u flag (curl handles encoding)
curl -u "username:app_password" "https://community.twobirdschurch.com/wp-json/tbc-wc/v1/events"

# Using header directly
curl -H "Authorization: Basic dXNlcm5hbWU6YXBwX3Bhc3N3b3Jk" "https://community.twobirdschurch.com/wp-json/tbc-wc/v1/events"
```

### Integration with TBC Community App

Use the `basic_auth` value returned from the Community App login endpoint:

```javascript
// After login via /wp-json/tbc-ca/v1/login
const authHeader = `Basic ${loginResponse.auth.basic_auth}`;

fetch('https://community.twobirdschurch.com/wp-json/tbc-wc/v1/events', {
  headers: {
    'Authorization': authHeader
  }
});
```

---

## Endpoints Overview

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/events` | GET | No (optional) | List events with filters |
| `/events/featured` | GET | No (optional) | Featured events widget |
| `/user/waitlist` | GET | **Yes** | Current user's waitlist |
| `/waitlist/join` | POST | **Yes** | Join event waitlist |
| `/waitlist/leave` | POST | **Yes** | Leave event waitlist |

---

## Events Endpoints

### GET /events

Returns a list of upcoming events with optional filtering.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `product_id` | integer | No | null | Filter to single product (series view) |
| `month` | string | No | null | Filter by month (format: `YYYY-MM`) |
| `limit` | integer | No | 50 | Maximum events to return |
| `category` | string | No | null | Filter by category slug |

#### Response

```json
{
  "events": [Event, ...],
  "meta": {
    "total": 3,
    "user_authenticated": true,
    "filters": {
      "product_id": null,
      "category": null,
      "month": "2025-01",
      "limit": 50
    }
  }
}
```

#### Examples

**Get next 3 upcoming events:**
```bash
curl "https://community.twobirdschurch.com/wp-json/tbc-wc/v1/events?limit=3"
```

**Get events for January 2025:**
```bash
curl "https://community.twobirdschurch.com/wp-json/tbc-wc/v1/events?month=2025-01"
```

**Get series view (single product's upcoming dates):**
```bash
curl "https://community.twobirdschurch.com/wp-json/tbc-wc/v1/events?product_id=33041&limit=5"
```

**Filter by category:**
```bash
curl "https://community.twobirdschurch.com/wp-json/tbc-wc/v1/events?category=sunday-service&limit=10"
```

**Authenticated request (includes user booking/waitlist status):**
```bash
curl -u "user:app_password" "https://community.twobirdschurch.com/wp-json/tbc-wc/v1/events?limit=5"
```

---

### GET /events/featured

Returns featured events for homepage widgets. Returns one open event per featured product, sorted by date.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | integer | No | 3 | Maximum events to return |

#### Response

```json
{
  "events": [Event, ...],
  "meta": {
    "total": 3,
    "user_authenticated": false
  }
}
```

#### Behavior

- Only returns events with `status: "open"` (excludes closed/waitlist/booked)
- Returns maximum one event per featured product
- Sorted by event date (soonest first)
- Default limit is 3

#### Example

```bash
curl "https://community.twobirdschurch.com/wp-json/tbc-wc/v1/events/featured"
```

---

## Waitlist Endpoints

All waitlist endpoints require authentication.

### GET /user/waitlist

Returns all waitlist entries for the authenticated user.

#### Response

```json
{
  "waitlist": [
    {
      "product_id": 33041,
      "title": "Sunday Service 🙏",
      "start": "2025-01-05",
      "end": "2025-01-05",
      "date_added": "2025-01-01 10:30:00",
      "url": "https://community.twobirdschurch.com/calendar/sunday-service/?selected_date=2025-01-05",
      "image": "https://media.twobirdschurch.com/wp-content/uploads/2021/03/cropped-Foreground-icon-1-300x170.png"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

#### Notes

- Only returns future events (past waitlist entries are excluded)
- Sorted by event date (soonest first)

#### Example

```bash
curl -u "user:app_password" "https://community.twobirdschurch.com/wp-json/tbc-wc/v1/user/waitlist"
```

---

### POST /waitlist/join

Add the authenticated user to an event's waitlist.

#### Request Body

```json
{
  "product_id": 33041,
  "event_date": "2025-01-05"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_id` | integer | Yes | Product/event ID |
| `event_date` | string | Yes | Event date (format: `YYYY-MM-DD`) |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Added to waitlist",
  "data": {
    "product_id": 33041,
    "event_date": "2025-01-05"
  }
}
```

#### Error Responses

**Already on waitlist (400):**
```json
{
  "code": "tbc_wc_already_on_waitlist",
  "message": "You are already on the waitlist for this event.",
  "data": { "status": 400 }
}
```

**Past event (400):**
```json
{
  "code": "tbc_wc_past_event",
  "message": "Cannot join waitlist for past events.",
  "data": { "status": 400 }
}
```

**Product not found (404):**
```json
{
  "code": "tbc_wc_invalid_product",
  "message": "Product not found.",
  "data": { "status": 404 }
}
```

**Not an event product (400):**
```json
{
  "code": "tbc_wc_not_event",
  "message": "This product is not an event.",
  "data": { "status": 400 }
}
```

#### Example

```bash
curl -X POST -u "user:app_password" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 33041, "event_date": "2025-01-05"}' \
  "https://community.twobirdschurch.com/wp-json/tbc-wc/v1/waitlist/join"
```

---

### POST /waitlist/leave

Remove the authenticated user from an event's waitlist.

#### Request Body

```json
{
  "product_id": 33041,
  "event_date": "2025-01-05"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_id` | integer | Yes | Product/event ID |
| `event_date` | string | Yes | Event date (format: `YYYY-MM-DD`) |

#### Success Response (200)

```json
{
  "success": true,
  "message": "Removed from waitlist",
  "data": {
    "product_id": 33041,
    "event_date": "2025-01-05"
  }
}
```

#### Error Response

**Not on waitlist (400):**
```json
{
  "code": "tbc_wc_not_on_waitlist",
  "message": "You are not on the waitlist for this event.",
  "data": { "status": 400 }
}
```

#### Example

```bash
curl -X POST -u "user:app_password" \
  -H "Content-Type: application/json" \
  -d '{"product_id": 33041, "event_date": "2025-01-05"}' \
  "https://community.twobirdschurch.com/wp-json/tbc-wc/v1/waitlist/leave"
```

---

## Response Objects

### Event Object

Complete event data returned from `/events` and `/events/featured` endpoints.

```json
{
  "product_id": 33041,
  "title": "Sunday Service 🙏",
  "start": "2025-12-28",
  "end": "2025-12-28",
  "start_time": "15:00",
  "end_time": "18:00",
  "status": "open",
  "location": {
    "business_name": "Two Birds Church",
    "address": "2493 CR 427, Anna, TX 75409"
  },
  "excerpt": "Join us Sundays at 3 p.m...",
  "price": "<span class=\"woocommerce-Price-amount\">$25.00</span>",
  "price_raw": 25.00,
  "image": "https://media.twobirdschurch.com/wp-content/uploads/.../image-300x170.jpg",
  "categories": ["sunday-service", "love-donation"],
  "url": "https://community.twobirdschurch.com/calendar/sunday-service/?selected_date=2025-12-28",
  "recurring_type": "interval",
  "calendar_color": "#28a745",
  "rsvp": null,
  "progress": null,
  "user": null
}
```

#### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `product_id` | integer | WooCommerce product ID |
| `title` | string | Event title |
| `start` | string | Start date (`YYYY-MM-DD`) |
| `end` | string | End date (`YYYY-MM-DD`) |
| `start_time` | string\|null | Start time (`HH:MM` 24hr) |
| `end_time` | string\|null | End time (`HH:MM` 24hr) |
| `status` | string | Event status (see below) |
| `location` | object | Location details |
| `excerpt` | string\|null | Short description |
| `price` | string | HTML-formatted price |
| `price_raw` | float | Numeric price value |
| `image` | string\|null | Featured image URL (medium size) |
| `categories` | array | Category slugs |
| `url` | string | Direct link to event page |
| `recurring_type` | string | `"single"`, `"individual"`, or `"interval"` |
| `calendar_color` | string | Hex color for calendar display (e.g., `"#28a745"`) |
| `rsvp` | object\|null | RSVP data (if enabled) |
| `progress` | object\|null | Progress/goal data (if enabled and threshold met) |
| `user` | object\|null | User-specific data (if authenticated) |

---

### Status Values

| Status | Description | UI Suggestion |
|--------|-------------|---------------|
| `open` | Available for booking | Show "Book Now" / "Available" |
| `closed` | Full or manually closed | Show "Waitlist" button |
| `booked` | User has booked this event | Show "You're Registered" |

**Note:** `booked` status only appears when authenticated and user has a booking.

---

### Location Object

```json
{
  "business_name": "Two Birds Church",
  "address": "2493 CR 427, Anna, TX 75409"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `business_name` | string\|null | Venue name |
| `address` | string\|null | Street address |

---

### RSVP Object

Only present when RSVP is enabled for the event.

```json
{
  "enabled": true,
  "deadline": "2025-01-03",
  "formatted_deadline": "January 3, 2025",
  "days_remaining": 8,
  "deadline_passed": false,
  "show_countdown": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `enabled` | boolean | Always `true` when present |
| `deadline` | string | Deadline date (`YYYY-MM-DD`) |
| `formatted_deadline` | string | Human-readable deadline |
| `days_remaining` | integer | Days until deadline |
| `deadline_passed` | boolean | Whether deadline has passed |
| `show_countdown` | boolean | Whether to display countdown |

**Note:** When `deadline_passed` is `true`, the event status will typically be `closed`.

---

### Progress Object

Only present when:
1. Progress tracking is enabled for the event
2. Inventory threshold is met (or no threshold set)

```json
{
  "goal_type": "sales",
  "goal": 20,
  "current": 16,
  "percentage": 80,
  "show_percentage": true,
  "above_text": "Help us reach our January goal!"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `goal_type` | string | `"sales"`, `"revenue"`, or `"subscribers"` |
| `goal` | integer | Target goal |
| `current` | integer\|float | Current progress (float for revenue) |
| `percentage` | integer | Progress percentage (0-100) |
| `show_percentage` | boolean | Whether to display percentage |
| `above_text` | string\|null | Custom text above progress bar |

**Note:** If `progress` is `null`, either progress is disabled or the threshold hasn't been met (don't show progress bar).

---

### User Object

Only present when request is authenticated.

```json
{
  "is_booked": false,
  "booked_quantity": null,
  "is_on_waitlist": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `is_booked` | boolean | User has booked this event |
| `booked_quantity` | integer\|null | Number of spots booked (null if not booked) |
| `is_on_waitlist` | boolean | User is on waitlist for this event |

#### UI Logic

```javascript
if (event.user === null) {
  // Not authenticated - show login prompt for waitlist actions
} else if (event.user.is_booked) {
  // Show "You're Registered" with quantity
} else if (event.status === 'closed') {
  if (event.user.is_on_waitlist) {
    // Show "Leave Waitlist" button
  } else {
    // Show "Join Waitlist" button
  }
} else {
  // Show "Book Now" button
}
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (validation error, business logic error) |
| 401 | Unauthorized (authentication required) |
| 404 | Not Found (product doesn't exist) |
| 500 | Server Error |

### Error Response Format

```json
{
  "code": "error_code",
  "message": "Human-readable error message",
  "data": {
    "status": 400
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `tbc_wc_invalid_product` | 404 | Product not found |
| `tbc_wc_not_event` | 400 | Product is not an event |
| `tbc_wc_past_event` | 400 | Event date is in the past |
| `tbc_wc_already_on_waitlist` | 400 | Already on waitlist |
| `tbc_wc_not_on_waitlist` | 400 | Not on waitlist |
| `tbc_wc_waitlist_unavailable` | 500 | Waitlist system not available |
| `tbc_wc_waitlist_failed` | 500 | Database error |

---

## Usage Examples

### React Native / Expo

```javascript
const API_BASE = 'https://community.twobirdschurch.com/wp-json/tbc-wc/v1';

// Store auth header after login
let authHeader = null;

// Set auth after Community App login
const setAuth = (basicAuth) => {
  authHeader = `Basic ${basicAuth}`;
};

// API helper
const api = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(authHeader && { 'Authorization': authHeader }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'API Error');
  }

  return data;
};

// Get upcoming events
const getEvents = async (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return api(`/events${query ? `?${query}` : ''}`);
};

// Get featured events
const getFeaturedEvents = async () => {
  return api('/events/featured');
};

// Get user's waitlist
const getMyWaitlist = async () => {
  return api('/user/waitlist');
};

// Join waitlist
const joinWaitlist = async (productId, eventDate) => {
  return api('/waitlist/join', {
    method: 'POST',
    body: JSON.stringify({
      product_id: productId,
      event_date: eventDate,
    }),
  });
};

// Leave waitlist
const leaveWaitlist = async (productId, eventDate) => {
  return api('/waitlist/leave', {
    method: 'POST',
    body: JSON.stringify({
      product_id: productId,
      event_date: eventDate,
    }),
  });
};
```

### Example: Event List Component

```javascript
const EventList = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents({ limit: 10 })
      .then(data => setEvents(data.events))
      .finally(() => setLoading(false));
  }, []);

  const handleWaitlistToggle = async (event) => {
    try {
      if (event.user?.is_on_waitlist) {
        await leaveWaitlist(event.product_id, event.start);
      } else {
        await joinWaitlist(event.product_id, event.start);
      }
      // Refresh events
      const data = await getEvents({ limit: 10 });
      setEvents(data.events);
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => `${item.product_id}-${item.start}`}
      renderItem={({ item }) => (
        <EventCard 
          event={item} 
          onWaitlistToggle={() => handleWaitlistToggle(item)}
        />
      )}
    />
  );
};
```

---

## Changelog

### 1.0.0 (2025-12-26)
- Initial release
- Events endpoint with filtering (product_id, month, category, limit)
- Featured events endpoint
- Waitlist management (view, join, leave)
- User booking and waitlist status in event responses
- RSVP deadline data
- Progress/goal tracking data with threshold logic