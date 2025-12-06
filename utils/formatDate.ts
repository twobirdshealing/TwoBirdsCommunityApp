// =============================================================================
// FORMAT DATE - Human-readable date/time formatting
// =============================================================================
// Converts timestamps like "2025-10-27T12:00:00" to "2 hours ago"
// =============================================================================

// -----------------------------------------------------------------------------
// Time Constants (in milliseconds)
// -----------------------------------------------------------------------------

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

// -----------------------------------------------------------------------------
// Format as Relative Time ("2 hours ago")
// -----------------------------------------------------------------------------

export function formatRelativeTime(dateString: string): string {
  // Parse the date string
  const date = new Date(dateString);
  const now = new Date();
  
  // Calculate the difference in milliseconds
  const diff = now.getTime() - date.getTime();
  
  // Handle future dates
  if (diff < 0) {
    return 'just now';
  }
  
  // Less than a minute
  if (diff < MINUTE) {
    return 'just now';
  }
  
  // Less than an hour
  if (diff < HOUR) {
    const minutes = Math.floor(diff / MINUTE);
    return `${minutes}m ago`;
  }
  
  // Less than a day
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours}h ago`;
  }
  
  // Less than a week
  if (diff < WEEK) {
    const days = Math.floor(diff / DAY);
    return `${days}d ago`;
  }
  
  // Less than a month
  if (diff < MONTH) {
    const weeks = Math.floor(diff / WEEK);
    return `${weeks}w ago`;
  }
  
  // Less than a year
  if (diff < YEAR) {
    const months = Math.floor(diff / MONTH);
    return `${months}mo ago`;
  }
  
  // More than a year
  const years = Math.floor(diff / YEAR);
  return `${years}y ago`;
}

// -----------------------------------------------------------------------------
// Format as Short Date ("Oct 27")
// -----------------------------------------------------------------------------

export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// -----------------------------------------------------------------------------
// Format as Full Date ("October 27, 2025")
// -----------------------------------------------------------------------------

export function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// -----------------------------------------------------------------------------
// Format as Date + Time ("Oct 27 at 3:45 PM")
// -----------------------------------------------------------------------------

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  
  return `${datePart} at ${timePart}`;
}

// -----------------------------------------------------------------------------
// Smart Format (relative if recent, date if older)
// -----------------------------------------------------------------------------

export function formatSmartDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // If within last 7 days, use relative
  if (diff < WEEK) {
    return formatRelativeTime(dateString);
  }
  
  // If this year, show month and day
  if (date.getFullYear() === now.getFullYear()) {
    return formatShortDate(dateString);
  }
  
  // Otherwise show full date
  return formatFullDate(dateString);
}

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export default {
  relative: formatRelativeTime,
  short: formatShortDate,
  full: formatFullDate,
  dateTime: formatDateTime,
  smart: formatSmartDate,
};
