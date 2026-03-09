// =============================================================================
// USE THEMED EDITOR - Shared 10tap editor bridge with app theming
// =============================================================================
// Centralises the editor bridge setup (theme CSS, bridge extensions, placeholder)
// used by CreatePostContent, CommentSheet, and BlogCommentSheet.
// =============================================================================

import { useEffect, useMemo } from 'react';
import {
  useEditorBridge,
  BridgeExtension,
  TenTapStartKit,
} from '@10play/tentap-editor';
import { useTheme } from '@/contexts/ThemeContext';
import { typography } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseThemedEditorOptions {
  /** Placeholder text shown when editor is empty. Default: 'Write a comment...' */
  placeholder?: string;
  /** Initial HTML content. Default: '' */
  initialContent?: string;
  /** Auto-focus the editor on mount. Default: false */
  autofocus?: boolean;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export function useThemedEditor({
  placeholder = 'Write a comment...',
  initialContent = '',
  autofocus = false,
}: UseThemedEditorOptions = {}) {
  const { colors } = useTheme();

  // Theme CSS injected into the WebView via BridgeExtension.extendCSS.
  // Runs on WebView load — no flash of unstyled content.
  const themeCSS = useMemo(() => `
    body {
      color: ${colors.text};
      background: ${colors.surface};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: ${typography.size.md}px;
      line-height: 1.4;
      padding: 0 12px;
      margin: 0;
    }
    h2 { font-size: ${typography.size.xl}px; font-weight: 600; margin: 12px 0; color: ${colors.text}; }
    h3 { font-size: ${typography.size.lg + 1}px; font-weight: 600; margin: 8px 0; color: ${colors.text}; }
    h4 { font-size: ${typography.size.md + 1}px; font-weight: 600; margin: 8px 0; color: ${colors.text}; }
    p { margin: 4px 0; }
    a { color: ${colors.primary}; text-decoration: underline; }
    blockquote {
      border-left: 3px solid ${colors.primary};
      padding-left: 12px;
      margin: 8px 0;
      color: ${colors.textSecondary};
      font-style: italic;
    }
    ul, ol { padding-left: 24px; margin: 6px 0; }
    li { margin: 2px 0; }
    code {
      background: ${colors.backgroundSecondary};
      padding: 2px 4px;
      border-radius: 3px;
      font-size: ${typography.size.sm}px;
    }
    pre {
      background: ${colors.backgroundSecondary};
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
    }
    pre code { background: none; padding: 0; }
    hr { border: none; border-top: 1px solid ${colors.border}; margin: 12px 0; }
    strong { font-weight: 700; }
    del, s { text-decoration: line-through; }
    .ProseMirror-focused { outline: none; }
    .is-editor-empty:first-child::before {
      color: ${colors.textTertiary};
      font-style: normal;
    }
  `, [colors.text, colors.surface, colors.primary, colors.textSecondary, colors.backgroundSecondary, colors.border, colors.textTertiary]);

  const themeBridge = useMemo(
    () => new BridgeExtension({ forceName: 'tbcTheme', extendCSS: themeCSS }),
    [themeCSS],
  );

  const bridgeExtensions = useMemo(
    () => [...TenTapStartKit, themeBridge],
    [themeBridge],
  );

  const editorTheme = useMemo(() => ({
    webview: { backgroundColor: colors.surface },
  }), [colors.surface]);

  const editor = useEditorBridge({
    initialContent,
    autofocus,
    avoidIosKeyboard: true,
    theme: editorTheme,
    bridgeExtensions,
  });

  // Set placeholder once editor WebView is ready.
  // _subscribeToEditorStateUpdate fires on the first state update from the WebView.
  // We unsubscribe immediately (single-fire) and return unsub for cleanup on unmount.
  useEffect(() => {
    if (!editor) return;
    const unsub = (editor as any)._subscribeToEditorStateUpdate(() => {
      editor.setPlaceholder(placeholder);
      unsub();
    });
    return unsub;
  }, [editor, placeholder]);

  return editor;
}
