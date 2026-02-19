// =============================================================================
// MARKDOWN - Formatting utilities for markdown text insertion
// =============================================================================
// Used by MarkdownToolbar to insert/toggle markdown syntax in TextInputs.
// Supports: Bold, Italic, Strikethrough, Inline Code, Link
// Server (Parsedown) converts markdown → HTML via FeedsHelper::mdToHtml()
// =============================================================================

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type MarkdownFormat = 'bold' | 'italic' | 'strikethrough' | 'code' | 'link';

export interface TextSelection {
  start: number;
  end: number;
}

export interface FormatResult {
  text: string;
  selection: TextSelection;
}

// Marker pairs for each format type
const FORMAT_MARKERS: Record<Exclude<MarkdownFormat, 'link'>, { open: string; close: string }> = {
  bold: { open: '**', close: '**' },
  italic: { open: '*', close: '*' },
  strikethrough: { open: '~~', close: '~~' },
  code: { open: '`', close: '`' },
};

// -----------------------------------------------------------------------------
// Main formatting function
// -----------------------------------------------------------------------------

/**
 * Apply markdown formatting to text at the given selection.
 *
 * - With selection: wraps selected text in markers (or unwraps if already wrapped)
 * - Without selection: inserts empty markers with cursor between them
 * - Link format: wraps as [text](url) or [](url)
 */
export function applyMarkdownFormat(
  text: string,
  selection: TextSelection,
  format: MarkdownFormat,
  linkUrl?: string,
): FormatResult {
  if (format === 'link') {
    return applyLinkFormat(text, selection, linkUrl || '');
  }

  const { open, close } = FORMAT_MARKERS[format];
  const hasSelection = selection.start !== selection.end;
  const selectedText = text.slice(selection.start, selection.end);

  // Check if selected text is already wrapped in these markers (toggle off)
  if (hasSelection && isWrapped(text, selection, open, close)) {
    return unwrap(text, selection, open, close);
  }

  // Wrap selected text or insert empty markers
  if (hasSelection) {
    const newText =
      text.slice(0, selection.start) +
      open + selectedText + close +
      text.slice(selection.end);

    return {
      text: newText,
      selection: {
        start: selection.start + open.length,
        end: selection.end + open.length,
      },
    };
  }

  // No selection — insert empty markers, cursor between them
  const newText =
    text.slice(0, selection.start) +
    open + close +
    text.slice(selection.start);

  return {
    text: newText,
    selection: {
      start: selection.start + open.length,
      end: selection.start + open.length,
    },
  };
}

// -----------------------------------------------------------------------------
// Link format
// -----------------------------------------------------------------------------

function applyLinkFormat(
  text: string,
  selection: TextSelection,
  url: string,
): FormatResult {
  const hasSelection = selection.start !== selection.end;
  const selectedText = hasSelection ? text.slice(selection.start, selection.end) : '';

  const linkMarkdown = `[${selectedText}](${url})`;

  const newText =
    text.slice(0, selection.start) +
    linkMarkdown +
    text.slice(selection.end);

  // Place cursor at end of the link markdown
  const cursorPos = selection.start + linkMarkdown.length;

  return {
    text: newText,
    selection: { start: cursorPos, end: cursorPos },
  };
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Check if the selection boundary text is wrapped in the given markers */
function isWrapped(
  text: string,
  selection: TextSelection,
  open: string,
  close: string,
): boolean {
  const beforeStart = selection.start - open.length;
  const afterEnd = selection.end + close.length;

  if (beforeStart < 0 || afterEnd > text.length) return false;

  return (
    text.slice(beforeStart, selection.start) === open &&
    text.slice(selection.end, afterEnd) === close
  );
}

/** Remove surrounding markers from the selection */
function unwrap(
  text: string,
  selection: TextSelection,
  open: string,
  close: string,
): FormatResult {
  const beforeStart = selection.start - open.length;
  const afterEnd = selection.end + close.length;

  const newText =
    text.slice(0, beforeStart) +
    text.slice(selection.start, selection.end) +
    text.slice(afterEnd);

  return {
    text: newText,
    selection: {
      start: beforeStart,
      end: beforeStart + (selection.end - selection.start),
    },
  };
}
