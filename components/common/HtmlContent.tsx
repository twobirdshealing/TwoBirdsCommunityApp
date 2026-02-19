// =============================================================================
// HTML CONTENT - Shared rich HTML renderer for feed posts, comments, and blogs
// =============================================================================
// Wraps react-native-render-html with theme-aware tag styles and link routing.
// Mentions (links to /portal/u/{username}/) navigate to in-app profiles.
// =============================================================================

import React, { useMemo } from 'react';
import { Linking } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, sizing } from '@/constants/layout';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface HtmlContentProps {
  /** Raw HTML string to render */
  html: string;
  /** Available width for layout (used by RenderHtml for images, etc.) */
  contentWidth: number;
  /** Base font size — defaults to typography.size.md (15) */
  baseFontSize?: number;
  /** Whether text is selectable — defaults to false */
  selectable?: boolean;
  /** Called before in-app navigation (e.g., to close a bottom sheet) */
  onLinkNavigate?: () => void;
}

// Regex to detect Fluent Community profile mention URLs
const MENTION_URL_REGEX = /\/portal\/u\/([^"'\/]+)\/?/;

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

function HtmlContentInner({
  html,
  contentWidth,
  baseFontSize = typography.size.md,
  selectable = false,
  onLinkNavigate,
}: HtmlContentProps) {
  const { colors: themeColors } = useTheme();
  const router = useRouter();

  // ---------------------------------------------------------------------------
  // Tag styles (memoized, theme-aware)
  // ---------------------------------------------------------------------------

  const tagsStyles = useMemo(
    () => ({
      body: {
        color: themeColors.text,
        fontSize: baseFontSize,
        lineHeight: baseFontSize * typography.lineHeight.relaxed,
      },
      p: {
        marginVertical: spacing.sm,
        color: themeColors.text,
      },
      h1: {
        color: themeColors.text,
        fontSize: typography.size.xxl,
        fontWeight: '700' as const,
        marginVertical: spacing.md,
      },
      h2: {
        color: themeColors.text,
        fontSize: typography.size.xl,
        fontWeight: '600' as const,
        marginVertical: spacing.md,
      },
      h3: {
        color: themeColors.text,
        fontSize: typography.size.lg,
        fontWeight: '600' as const,
        marginVertical: spacing.sm,
      },
      a: {
        color: themeColors.primary,
        textDecorationLine: 'underline' as const,
      },
      blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: themeColors.primary,
        paddingLeft: spacing.md,
        marginVertical: spacing.md,
        fontStyle: 'italic' as const,
        color: themeColors.textSecondary,
      },
      img: {
        borderRadius: sizing.borderRadius.sm,
      },
      ul: { color: themeColors.text },
      ol: { color: themeColors.text },
      li: { color: themeColors.text, marginVertical: spacing.xs },
      pre: {
        backgroundColor: themeColors.backgroundSecondary,
        padding: spacing.md,
        borderRadius: sizing.borderRadius.sm,
        overflow: 'hidden' as const,
      },
      code: {
        backgroundColor: themeColors.backgroundSecondary,
        fontSize: typography.size.sm,
      },
      em: {
        color: themeColors.text,
      },
      strong: {
        color: themeColors.text,
        fontWeight: '700' as const,
      },
      del: {
        textDecorationLine: 'line-through' as const,
        color: themeColors.text,
      },
      s: {
        textDecorationLine: 'line-through' as const,
        color: themeColors.text,
      },
      figure: {
        marginVertical: spacing.md,
      },
      figcaption: {
        color: themeColors.textSecondary,
        fontSize: typography.size.sm,
        textAlign: 'center' as const,
        marginTop: spacing.xs,
      },
    }),
    [themeColors, baseFontSize]
  );

  // ---------------------------------------------------------------------------
  // Link handler — mentions navigate in-app, others open externally
  // ---------------------------------------------------------------------------

  const renderersProps = useMemo(
    () => ({
      a: {
        onPress: (_event: any, href: string) => {
          if (!href) return;

          const mentionMatch = href.match(MENTION_URL_REGEX);
          if (mentionMatch) {
            const username = mentionMatch[1];
            onLinkNavigate?.();
            router.push({
              pathname: '/profile/[username]' as any,
              params: { username },
            });
            return;
          }

          Linking.openURL(href);
        },
      },
      img: {
        enableExperimentalPercentWidth: true,
      },
    }),
    [onLinkNavigate, router]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!html) return null;

  return (
    <RenderHtml
      contentWidth={contentWidth}
      source={{ html }}
      tagsStyles={tagsStyles}
      renderersProps={renderersProps}
      enableExperimentalBRCollapsing={true}
      enableExperimentalGhostLinesPrevention={true}
      defaultTextProps={{ selectable }}
    />
  );
}

export const HtmlContent = React.memo(HtmlContentInner);
