// =============================================================================
// APP CONFIG API SERVICE - Fetch Fluent Community theme colors & app settings
// =============================================================================
// Public endpoint (no auth needed) — returns theme + social providers
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import { getAuthToken } from '@/services/auth';
import type { SocialProvider } from './socialProviders';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface FluentSectionColors {
  [key: string]: string | undefined;
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

export interface ThemeData {
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

export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  can_bypass?: boolean; // Only present when authenticated
}

export interface VisibilityConfig {
  hide_cart: boolean;
  hide_menu: string[]; // e.g. ['blog', 'courses']
}

export interface UpdateConfig {
  min_version: string;
  ios_store_url: string;
  android_store_url: string;
}

export interface AppConfigResponse {
  success: boolean;
  theme: ThemeData;
  social_providers: SocialProvider[];
  portal_slug?: string;
  update?: UpdateConfig | null;
  maintenance?: MaintenanceConfig;
  visibility?: VisibilityConfig;
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/**
 * GET /app-config - Fetch theme colors + social providers (public, no auth)
 */
export async function getAppConfig(): Promise<AppConfigResponse | null> {
  try {
    const response = await fetch(`${TBC_CA_URL}/app-config`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) return null;

    const data: AppConfigResponse = await response.json();
    return data.success ? data : null;
  } catch (error) {
    if (__DEV__) console.error('[App Config API]', error);
    return null;
  }
}

/**
 * GET /app-config with JWT - Returns maintenance bypass + visibility flags
 */
export async function getAppConfigAuthenticated(): Promise<AppConfigResponse | null> {
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = { 'Accept': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${TBC_CA_URL}/app-config`, { headers });
    if (!response.ok) return null;

    const data: AppConfigResponse = await response.json();
    return data.success ? data : null;
  } catch (error) {
    if (__DEV__) console.error('[App Config API - Auth]', error);
    return null;
  }
}
