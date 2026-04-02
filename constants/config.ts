// =============================================================================
// CONFIG - App configuration and API settings
// =============================================================================
// For modules (calendar, blog, etc.), edit modules/_registry.ts
// =============================================================================

import Constants from 'expo-constants';
import type { ImageSource } from 'expo-image';
import type { BrandingConfig } from '@/services/api/appConfig';

// =============================================================================
// YOUR CONFIG — Edit these values to match your site.
// This section is yours to edit. Core updates won't touch it.
// =============================================================================

// --- App Info ----------------------------------------------------------------

export const APP_NAME = 'Two Birds Community';          // Your app name
export const APP_USER_AGENT = 'TBCCommunityApp/1.0';   // User agent for API requests

// --- Site URL ----------------------------------------------------------------
// Set your WordPress site URL in eas.json (env.EXPO_PUBLIC_SITE_URL).
// app.config.ts reads it and passes it via expo.extra.siteUrl.

export const SITE_URL: string = process.env.EXPO_PUBLIC_SITE_URL || Constants.expoConfig?.extra?.siteUrl;

// Dev-only: true when running npm run dev:staging
export const IS_STAGING: boolean = __DEV__ && process.env.EXPO_PUBLIC_USE_STAGING === '1';

// --- Feature Flags -----------------------------------------------------------
// Feature flags are now controlled from wp-admin → TBC Community App → Features tab.
// The app fetches them via /app-config on startup (see AppConfigContext + useFeatures hook).
// No build-time feature flags needed — defaults are hardcoded in AppConfigContext.
// -------------------------------------------------------------------------

// --- Links -------------------------------------------------------------------

export const PRIVACY_POLICY_URL = `${SITE_URL}/privacy-policy/`;

// =============================================================================
// END YOUR CONFIG — Everything below is core. Do not edit.
// =============================================================================

// Re-export all core constants and endpoints from config-core.ts
// (config-core.ts is NOT protected — it gets overwritten on updates)
export * from './config-core';

// -----------------------------------------------------------------------------
// Branding Helpers (server-synced logo from Fluent Community)
// -----------------------------------------------------------------------------

// Login logo mode: 'dynamic' = server-synced from Fluent Community (no static file needed),
// 'static' = bundled image fallback. Toggled via the setup dashboard.
const LOGIN_LOGO_MODE = 'dynamic';
const STATIC_LOGO: ImageSource | null = null; // static mode: require('@/assets/images/login_logo.png')

/** Logo for login/register/forgot-password. Uses dark variant when available in dark mode. */
export function getLogoSource(
  branding: BrandingConfig | null,
  isDark: boolean,
): ImageSource | null {
  const url = isDark && branding?.logo_dark ? branding.logo_dark : branding?.logo;
  if (url) return { uri: url };
  return STATIC_LOGO;
}

/** Header logo — returns null when no branding logo is available (no static fallback). */
export function getHeaderLogoSource(
  branding: BrandingConfig | null,
  isDark: boolean = false,
): ImageSource | null {
  const url = isDark && branding?.logo_dark ? branding.logo_dark : branding?.logo;
  if (url) return { uri: url };
  return null;
}
