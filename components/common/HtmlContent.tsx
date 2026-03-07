// =============================================================================
// HTML CONTENT - Shared rich HTML renderer for feed posts, comments, and blogs
// =============================================================================
// Wraps react-native-render-html with theme-aware tag styles and link routing.
// Community URLs (profiles, spaces, posts, courses) navigate in-app via the
// centralized deep link mapper. Non-community URLs open externally.
// =============================================================================

import React, { useMemo } from 'react';
import { Linking } from 'react-native';
import RenderHtml from 'react-native-render-html';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppConfig } from '@/contexts/AppConfigContext';
import { mapUrlToRoute } from '@/utils/deepLinkMapper';
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
  const { portalSlug } = useAppConfig();
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
        fontWeight: typography.weight.bold,
        marginVertical: spacing.md,
      },
      h2: {
        color: themeColors.text,
        fontSize: typography.size.xl,
        fontWeight: typography.weight.semibold,
        marginVertical: spacing.md,
      },
      h3: {
        color: themeColors.text,
        fontSize: typography.size.lg,
        fontWeight: typography.weight.semibold,
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
        fontWeight: typography.weight.bold,
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
  // Link handler — community URLs navigate in-app, others open externally
  // ---------------------------------------------------------------------------

  const renderersProps = useMemo(
    () => ({
      a: {
        onPress: (_event: any, href: string) => {
          if (!href) return;

          const route = mapUrlToRoute(href, portalSlug);
          if (route) {
            onLinkNavigate?.();
            router.push(route as any);
            return;
          }

          Linking.openURL(href);
        },
      },
      img: {
        enableExperimentalPercentWidth: true,
      },
    }),
    [onLinkNavigate, router, portalSlug]
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
