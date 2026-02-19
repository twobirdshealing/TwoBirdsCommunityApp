// =============================================================================
// MARKDOWN STYLE - Theme-aware styles for MarkdownTextInput
// =============================================================================
// Maps our theme colors to the MarkdownStyle object used by
// @expensify/react-native-live-markdown for live formatting in the input.
// =============================================================================

import type { ColorTheme } from './colors';

// -----------------------------------------------------------------------------
// Style builder
// -----------------------------------------------------------------------------

/**
 * Build a MarkdownStyle object from our theme colors.
 * This controls how formatted text appears inside the MarkdownTextInput.
 */
export function getMarkdownStyle(colors: ColorTheme) {
  return {
    // Syntax markers (**, ~~, `, [, ], (, )) — faded so they don't distract
    syntax: {
      color: colors.textTertiary,
    },
    // Bold text
    bold: {
      fontWeight: 'bold' as const,
    },
    // Italic text
    italic: {
      fontStyle: 'italic' as const,
    },
    // Strikethrough text
    strikethrough: {
      textDecorationLine: 'line-through' as const,
    },
    // Links — colored like theme primary
    link: {
      color: colors.primary,
    },
    // Inline code — monospace with subtle background
    code: {
      fontFamily: 'monospace',
      backgroundColor: colors.backgroundSecondary,
    },
  };
}
