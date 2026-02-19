// =============================================================================
// MARKDOWN PARSER - Worklet for live markdown rendering in MarkdownTextInput
// =============================================================================
// Custom parser that detects standard markdown syntax and returns styled ranges.
// Runs on the UI thread (worklet) for instant formatting on every keystroke.
// Replaces the default ExpensiMark parser so we don't need expensify-common.
//
// Supported formats: Bold, Italic, Strikethrough, Inline Code, Link
// =============================================================================

// -----------------------------------------------------------------------------
// Types (imported from @expensify/react-native-live-markdown)
// -----------------------------------------------------------------------------

import type { MarkdownRange } from '@expensify/react-native-live-markdown/src/commonTypes';

// -----------------------------------------------------------------------------
// Parser worklet
// -----------------------------------------------------------------------------

/**
 * Parse standard markdown syntax and return ranges for live rendering.
 * Each match produces:
 *   - 'syntax' ranges for the markers (**, ~~, `, etc.) — rendered faded
 *   - format ranges ('bold', 'italic', etc.) for the content — rendered styled
 */
export function parseMarkdown(input: string): MarkdownRange[] {
  'worklet';

  const ranges: MarkdownRange[] = [];

  // -------------------------------------------------------------------------
  // Bold: **text**
  // -------------------------------------------------------------------------
  const boldRegex = /\*\*(.+?)\*\*/g;
  let match;
  while ((match = boldRegex.exec(input)) !== null) {
    // Opening **
    ranges.push({ type: 'syntax', start: match.index, length: 2 });
    // Bold content
    ranges.push({ type: 'bold', start: match.index + 2, length: match[1].length });
    // Closing **
    ranges.push({ type: 'syntax', start: match.index + 2 + match[1].length, length: 2 });
  }

  // -------------------------------------------------------------------------
  // Strikethrough: ~~text~~
  // -------------------------------------------------------------------------
  const strikeRegex = /~~(.+?)~~/g;
  while ((match = strikeRegex.exec(input)) !== null) {
    ranges.push({ type: 'syntax', start: match.index, length: 2 });
    ranges.push({ type: 'strikethrough', start: match.index + 2, length: match[1].length });
    ranges.push({ type: 'syntax', start: match.index + 2 + match[1].length, length: 2 });
  }

  // -------------------------------------------------------------------------
  // Inline code: `text`
  // -------------------------------------------------------------------------
  const codeRegex = /`([^`]+?)`/g;
  while ((match = codeRegex.exec(input)) !== null) {
    ranges.push({ type: 'syntax', start: match.index, length: 1 });
    ranges.push({ type: 'code', start: match.index + 1, length: match[1].length });
    ranges.push({ type: 'syntax', start: match.index + 1 + match[1].length, length: 1 });
  }

  // -------------------------------------------------------------------------
  // Italic: *text* (single asterisk, not inside bold **)
  // Uses negative lookbehind/lookahead to avoid matching inside **bold**
  // -------------------------------------------------------------------------
  const italicRegex = /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g;
  while ((match = italicRegex.exec(input)) !== null) {
    ranges.push({ type: 'syntax', start: match.index, length: 1 });
    ranges.push({ type: 'italic', start: match.index + 1, length: match[1].length });
    ranges.push({ type: 'syntax', start: match.index + 1 + match[1].length, length: 1 });
  }

  // -------------------------------------------------------------------------
  // Link: [text](url)
  // -------------------------------------------------------------------------
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  while ((match = linkRegex.exec(input)) !== null) {
    const fullMatch = match[0];
    const linkText = match[1];
    const url = match[2];

    // Opening [
    ranges.push({ type: 'syntax', start: match.index, length: 1 });
    // Link text
    ranges.push({ type: 'link', start: match.index + 1, length: linkText.length });
    // ](
    ranges.push({ type: 'syntax', start: match.index + 1 + linkText.length, length: 2 });
    // URL
    ranges.push({ type: 'syntax', start: match.index + 1 + linkText.length + 2, length: url.length });
    // Closing )
    ranges.push({ type: 'syntax', start: match.index + fullMatch.length - 1, length: 1 });
  }

  return ranges;
}
