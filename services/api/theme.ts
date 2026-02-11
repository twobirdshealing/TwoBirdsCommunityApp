// =============================================================================
// THEME API SERVICE - Fetch Fluent Community theme colors
// =============================================================================
// Public endpoint (no auth needed) — returns site color configuration
// =============================================================================

import { SITE_URL } from '@/constants/config';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FluentSectionColors {
  primary_bg?: string;
  secondary_bg?: string;
  secondary_content_bg?: string;
  active_bg?: string;
  light_bg?: string;
  deep_bg?: string;
  menu_text?: string;
  primary_text?: string;
  secondary_text?: string;
  text_off?: string;
  primary_button?: string;
  primary_button_text?: string;
  primary_border?: string;
  secondary_border?: string;
  highlight_bg?: string;
  text_link?: string;
  menu_text_active?: string;
  menu_text_hover?: string;
  menu_bg_hover?: string;
}

export interface ThemeColorsResponse {
  success: boolean;
  dark_mode_enabled: boolean;
  light_schema: string;
  dark_schema: string;
  light: {
    body: FluentSectionColors;
    header: FluentSectionColors;
    sidebar: FluentSectionColors;
  } | null;
  dark: {
    body: FluentSectionColors;
    header: FluentSectionColors;
    sidebar: FluentSectionColors;
  } | null;
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

const TBC_CA_BASE = `${SITE_URL}/wp-json/tbc-ca/v1`;

/**
 * GET /theme/colors - Fetch site theme colors (public, no auth)
 */
export async function getThemeColors(): Promise<ThemeColorsResponse | null> {
  try {
    const response = await fetch(`${TBC_CA_BASE}/theme/colors`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data: ThemeColorsResponse = await response.json();
    return data.success ? data : null;
  } catch (error) {
    console.error('[Theme API]', error);
    return null;
  }
}
