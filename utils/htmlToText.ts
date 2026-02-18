// =============================================================================
// HTML TO TEXT - Strip HTML tags and convert to plain text
// =============================================================================
// The API returns HTML in message_rendered, this helps display it cleanly.
// =============================================================================

// -----------------------------------------------------------------------------
// Strip All HTML Tags
// -----------------------------------------------------------------------------

export function stripHtmlTags(html: string | null | undefined): string {
  if (!html) return '';
  
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  
  // Decode common HTML entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
  
  // Remove extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

// -----------------------------------------------------------------------------
// Strip Tags but Preserve Line Breaks
// -----------------------------------------------------------------------------

export function stripHtmlPreserveBreaks(html: string | null | undefined): string {
  if (!html) return '';
  
  // Convert <br>, <p>, and </p> to newlines
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '');
  
  // Remove remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode entities
  text = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Clean up multiple newlines
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  
  return text;
}

// -----------------------------------------------------------------------------
// Decode HTML Entities (WordPress title entities like &#8217;)
// -----------------------------------------------------------------------------

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#8217;/g, '\u2019')  // right single quote
    .replace(/&#8216;/g, '\u2018')  // left single quote
    .replace(/&#8220;/g, '\u201C')  // left double quote
    .replace(/&#8221;/g, '\u201D')  // right double quote
    .replace(/&#8211;/g, '\u2013')  // en dash
    .replace(/&#8212;/g, '\u2014')  // em dash
    .replace(/&#8230;/g, '\u2026')  // ellipsis
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// -----------------------------------------------------------------------------
// Truncate Text with Ellipsis
// -----------------------------------------------------------------------------

export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  
  if (text.length <= maxLength) {
    return text;
  }
  
  // Find the last space before the limit
  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  // If there's a space, cut there; otherwise, cut at the limit
  const cutPoint = lastSpace > maxLength * 0.8 ? lastSpace : maxLength;
  
  return text.substring(0, cutPoint).trim() + '...';
}

// -----------------------------------------------------------------------------
// Extract Text Preview (for feed cards)
// -----------------------------------------------------------------------------

export function extractPreview(html: string | null | undefined, maxLength: number = 150): string {
  const plainText = stripHtmlTags(html);
  return truncateText(plainText, maxLength);
}

// -----------------------------------------------------------------------------
// Extract Mentions from Text (@username)
// -----------------------------------------------------------------------------

export function extractMentions(text: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const matches = text.match(mentionRegex);
  
  if (!matches) return [];
  
  // Remove the @ symbol
  return matches.map(m => m.substring(1));
}

// -----------------------------------------------------------------------------
// Check if Content Has Media
// -----------------------------------------------------------------------------

export function hasMediaContent(html: string | null | undefined): boolean {
  if (!html) return false;
  
  return (
    /<img/i.test(html) ||
    /<video/i.test(html) ||
    /<iframe/i.test(html) ||
    /<audio/i.test(html)
  );
}

// -----------------------------------------------------------------------------
// Default Export
// -----------------------------------------------------------------------------

export default {
  strip: stripHtmlTags,
  stripPreserveBreaks: stripHtmlPreserveBreaks,
  decodeEntities: decodeHtmlEntities,
  truncate: truncateText,
  preview: extractPreview,
  mentions: extractMentions,
  hasMedia: hasMediaContent,
};
