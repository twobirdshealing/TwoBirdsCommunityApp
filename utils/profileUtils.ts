// =============================================================================
// PROFILE UTILS - Utility functions for profile display
// =============================================================================

/**
 * Strip HTML tags from a string
 */
export function stripHtml(html: string): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Generate post excerpt from post object
 */
export function getPostExcerpt(post: any, maxLength: number = 50): string {
  // Prefer title if available
  if (post.title && post.title.trim()) {
    let excerpt = post.title.trim();
    
    // Add type suffix if not 'text'
    if (post.type && post.type !== 'text') {
      excerpt += ` (${post.type})`;
    }
    
    return excerpt;
  }
  
  // Fallback to message
  const message = stripHtml(post.message || post.message_rendered || '');
  let excerpt = message.substring(0, maxLength);
  
  if (message.length > maxLength) {
    excerpt += '...';
  }
  
  // Add type suffix
  if (post.type && post.type !== 'text') {
    excerpt += ` (${post.type})`;
  }
  
  return excerpt;
}

/**
 * Format relative time (e.g., "5m ago", "2h ago", "3d ago")
 */
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  } else if (diffMin < 60) {
    return `${diffMin}m ago`;
  } else if (diffHour < 24) {
    return `${diffHour}h ago`;
  } else if (diffDay < 7) {
    return `${diffDay}d ago`;
  } else if (diffWeek < 4) {
    return `${diffWeek}w ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Format compact number (e.g., 1.2k, 3.5M)
 */
export function formatCompactNumber(num: number): string {
  if (num < 1000) return num.toString();
  if (num < 1000000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
}
