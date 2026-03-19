// =============================================================================
// APP CONFIG API SERVICE - Fetch app config from /tbc-ca/v1/app-config
// =============================================================================
// Public endpoint — returns theme colors, branding, social providers,
// maintenance status, update config, and (when auth'd) visibility flags.
// Includes JWT when available for role-based visibility.
// =============================================================================

import { TBC_CA_URL } from '@/constants/config';
import { getAuthToken } from '@/services/auth';
import type { SocialProvider } from './socialProviders';
import { createLogger } from '@/utils/logger';

const log = createLogger('AppConfigAPI');

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
  hide_menu: string[]; // e.g. ['blog', 'courses', 'cart']
}

export interface UpdateConfig {
  min_version: string;
  ios_store_url: string;
  android_store_url: string;
}

export interface BrandingConfig {
  site_name: string;
  site_tagline: string;
  logo: string;       // Logo URL from Fluent (used everywhere — header + login)
  logo_dark: string;  // Logo for dark mode (Fluent's white_logo)
}

export interface SocketConfig {
  enabled: boolean;
  api_key: string;
  auth_endpoint: string;
  options: {
    cluster: string;
    wsHost?: string;
    wsPort?: number;
    wssPort?: number;
    forceTLS?: boolean;
    enabledTransports?: string[];
  };
}

export interface RegistrationConfig {
  enabled: boolean;
  email_verification: boolean;
  /** Module-specific config fields from server plugins */
  [key: string]: any;
}

export interface FeaturesConfig {
  dark_mode: boolean;
  push_notifications: boolean;
  messaging: boolean;
  courses: boolean;
  multi_reactions: boolean;
  profile_tabs: {
    posts: boolean;
    spaces: boolean;
    comments: boolean;
  };
}

/** Keys of FeaturesConfig whose value is boolean (excludes nested objects like profile_tabs) */
export type BooleanFeatureKey = {
  [K in keyof FeaturesConfig]: FeaturesConfig[K] extends boolean ? K : never;
}[keyof FeaturesConfig];

export interface AppConfigResponse {
  success: boolean;
  theme: ThemeData;
  social_providers: SocialProvider[];
  portal_slug?: string;
  update?: UpdateConfig | null;
  maintenance?: MaintenanceConfig;
  visibility?: VisibilityConfig;
  branding?: BrandingConfig;
  socket?: SocketConfig | null;
  registration?: RegistrationConfig;
  /** Feature flags controlled from wp-admin */
  features?: FeaturesConfig;
  /** WordPress time format string (e.g. 'g:i a' for 12h, 'H:i' for 24h) */
  time_format?: string;
}

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/**
 * GET /app-config - Fetch theme, maintenance, visibility & social providers.
 * Automatically includes JWT when available (returns can_bypass + visibility).
 */
export async function getAppConfig(): Promise<AppConfigResponse | null> {
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
    log.error(error);
    return null;
  }
}
