// =============================================================================
// HTML TO MARKDOWN - Converts 10tap editor HTML output to markdown for server
// =============================================================================
// Uses turndown + GFM plugin to produce markdown compatible with Fluent
// Community's Parsedown. Called on submit before sending to the API.
// =============================================================================

import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// Singleton — no need to recreate on every call
const turndownService = new TurndownService({
  headingStyle: 'atx',           // ## Heading (not underline style)
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',      // ```code``` (not indented)
  emDelimiter: '*',
  strongDelimiter: '**',
});

// Add GFM support (strikethrough ~~text~~, tables)
turndownService.use(gfm);

/**
 * Convert HTML string to markdown compatible with Fluent Community's Parsedown.
 * Returns empty string for empty/whitespace-only content.
 */
export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return '';

  // 10tap wraps empty content in <p></p> — treat as empty
  const stripped = html.replace(/<p><\/p>/g, '').trim();
  if (!stripped) return '';

  return turndownService.turndown(html).trim();
}
