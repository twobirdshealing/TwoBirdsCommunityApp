// =============================================================================
// MODULE TYPES - Shared type definitions for the module system
// =============================================================================
// Modules are self-contained features (calendar, blog, etc.) that register
// their tabs, widgets, and providers via a manifest. Core code reads from
// the registry (_registry.ts) to wire everything together at build time.
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import type { Router } from 'expo-router';
import { FEATURES } from '@/constants/config';
import type { ColorTheme } from '@/constants/colors';
import type { RegistrationConfig } from '@/services/api/appConfig';

/** Keys of ColorTheme whose values are strings (excludes nested objects like tabBar) */
type ColorTokenKey = { [K in keyof ColorTheme]: ColorTheme[K] extends string ? K : never }[keyof ColorTheme];

// -----------------------------------------------------------------------------
// Tab Registration
// -----------------------------------------------------------------------------

export interface TabRegistration {
  /** Must match the filename in app/(tabs)/ (e.g. 'calendar' → app/(tabs)/calendar.tsx) */
  name: string;
  /** Display title shown under the tab icon */
  title: string;
  /** Ionicon name for focused state */
  icon: keyof typeof Ionicons.glyphMap;
  /** Ionicon name for unfocused state */
  iconOutline: keyof typeof Ionicons.glyphMap;
  /** Sort position (core tabs: Home=10, Activity=20, Spaces=30) */
  order: number;
  /** The tab screen component (re-exported from the route stub) */
  component: React.ComponentType;
  /** Server visibility key — tab hidden when this key is in hide_menu[] */
  hideMenuKey?: string;
  /** Intercept tab press (e.g. to open WebView instead of navigating) */
  interceptPress?: (router: any) => void;
  /** Custom tab icon component (overrides icon/iconOutline if provided) */
  tabBarIcon?: (props: { focused: boolean; color: string }) => React.ReactNode;
  /** Override tab color — use a theme token name (e.g. 'error' for red). Defaults to tabBar.active/inactive */
  tabColor?: ColorTokenKey;
}

// -----------------------------------------------------------------------------
// Widget Registration
// -----------------------------------------------------------------------------

export interface WidgetRegistration {
  /** Unique stable ID — never change once shipped (used as AsyncStorage key) */
  id: string;
  /** Display title shown in HomeWidget header */
  title: string;
  /** Ionicon name for header */
  icon?: keyof typeof Ionicons.glyphMap;
  /** "See all" route — if undefined, no "See all" link */
  seeAllRoute?: string;
  /** Feature flag key — if set and false, widget is excluded entirely */
  featureFlag?: keyof typeof FEATURES;
  /** Default enabled state for new users */
  defaultEnabled: boolean;
  /** Whether the user can disable this widget */
  canDisable: boolean;
  /** Whether the home screen wraps this in HomeWidget (true) or widget handles its own layout (false) */
  externalWrapper: boolean;
  /** The widget component — receives refreshKey prop */
  component: React.ComponentType<{ refreshKey: number }>;
}

// -----------------------------------------------------------------------------
// Provider Registration
// -----------------------------------------------------------------------------

export interface ProviderRegistration {
  /** Unique ID for the provider */
  id: string;
  /** Sort order — lower numbers wrap outer (rendered first in the tree) */
  order: number;
  /** The context provider component */
  component: React.ComponentType<{ children: React.ReactNode }>;
}

// -----------------------------------------------------------------------------
// Menu Item Registration (UserMenu dropdown)
// -----------------------------------------------------------------------------

export interface MenuItemRegistration {
  /** Unique ID for this menu item */
  id: string;
  /** Display label */
  label: string;
  /** Ionicon name */
  icon: keyof typeof Ionicons.glyphMap;
  /** Route to navigate to (e.g. '/blog' or { pathname: '/webview', params: {...} }) */
  route: string | { pathname: string; params: Record<string, string> };
  /** Sort position — core items use 10-90, place yours between them */
  order: number;
  /** Server visibility key — item hidden when this key is in hide_menu[] */
  hideMenuKey?: string;
  /** Override icon color — use a theme token name (e.g. 'error' for red). Defaults to textSecondary */
  iconColor?: string;
}

// -----------------------------------------------------------------------------
// Header Icon Registration (TopHeader right section)
// -----------------------------------------------------------------------------

export interface HeaderIconRegistration {
  /** Unique ID for this header icon */
  id: string;
  /** Ionicon name */
  icon: keyof typeof Ionicons.glyphMap;
  /** Route to navigate to */
  route: string | { pathname: string; params: Record<string, string> };
  /** Sort position — core icons: Messages=10, Notifications=20, Cart=30 */
  order: number;
  /** Accessibility label */
  accessibilityLabel?: string;
  /** Server visibility key — icon hidden when this key is in hide_menu[] */
  hideMenuKey?: string;
}

// -----------------------------------------------------------------------------
// Registration Step Registration
// -----------------------------------------------------------------------------

/** Props passed to every registration step component rendered inline in the register screen */
export interface RegistrationStepProps {
  formData: Record<string, any>;
  submitResponse: Record<string, any>;
  submitting: boolean;
  /** Resubmit the registration form with verification extras merged in */
  onResubmit: (extras: Record<string, any>) => Promise<void>;
  /** Signal that this step is complete */
  onComplete: () => void;
  /** Go back to the previous step */
  onBack: () => void;
}

export interface RegistrationStepRegistration {
  /** Unique step ID (e.g. 'email-verify') */
  id: string;
  /** Sort order: email=10. Module steps can use any value (e.g. 20, 30). */
  order: number;
  /** Step runs before user account creation (all module steps are pre-creation) */
  phase: 'pre-creation';
  /** Step title shown in the register screen header */
  title: string;
  /** The component to render for this step (rendered inline in the register screen) */
  component: React.ComponentType<RegistrationStepProps>;
  /**
   * Determines if this step is active for the current registration session.
   * Called after form submission with the server response and app registration config.
   */
  shouldActivate: (context: {
    submitResponse: Record<string, any>;
    registrationConfig: RegistrationConfig | null;
  }) => boolean;
}

// -----------------------------------------------------------------------------
// Response Header Mapping (module-injected API response headers)
// -----------------------------------------------------------------------------

export interface ResponseHeaderMapping {
  /** HTTP response header name (e.g. 'X-TBC-Profile-Incomplete') */
  header: string;
  /** Key name in the header data object (e.g. 'profileIncomplete') */
  key: string;
  /** Transform the raw header string value. Default: pass through as-is. */
  transform?: (value: string) => any;
}

// -----------------------------------------------------------------------------
// Module Manifest
// -----------------------------------------------------------------------------

export interface ModuleManifest {
  /** Unique module ID */
  id: string;
  /** Human-readable module name */
  name: string;
  /** Module version (semver) */
  version: string;
  /** Short description of what this module does */
  description?: string;
  /** Module author or company name */
  author?: string;
  /** Author or module website URL */
  authorUrl?: string;
  /** Software license (e.g. 'MIT', 'Proprietary') */
  license?: string;
  /** Minimum app version required (semver, e.g. '3.0.0') */
  minAppVersion?: string;
  /** Tab registration — adds a bottom tab for this module */
  tab?: TabRegistration;
  /** Widget registrations — adds home screen widgets */
  widgets?: WidgetRegistration[];
  /** Provider registrations — adds context providers to the app tree */
  providers?: ProviderRegistration[];
  /** Menu item registrations — adds items to the UserMenu dropdown */
  menuItems?: MenuItemRegistration[];
  /** Header icon registrations — adds icons to the TopHeader */
  headerIcons?: HeaderIconRegistration[];
  /** Server visibility key for hide_menu (convenience — also available on tab) */
  hideMenuKey?: string;
  /** Companion WordPress plugin slug (for documentation) */
  companionPlugin?: string;
  /** API base URL if different from main Fluent Community API */
  apiBase?: string;
  /** Component rendered above the tab bar (e.g., mini player, cart bar) */
  tabBarAddon?: React.ComponentType;
  /** Route prefixes for push notification / deep link validation (e.g. ['/bookclub']) */
  routePrefixes?: string[];
  /** Registration step registrations — adds steps to the registration flow */
  registrationSteps?: RegistrationStepRegistration[];
  /** Response header mappings — extracts custom headers from every API response */
  responseHeaders?: ResponseHeaderMapping[];

  // ---------------------------------------------------------------------------
  // Lifecycle hooks (all optional)
  // ---------------------------------------------------------------------------

  /** Called once after auth is confirmed on app start (fire-and-forget) */
  onInit?: () => void | Promise<void>;
  /** Called on logout — clear module-specific caches or state */
  onCleanup?: () => void;

  // ---------------------------------------------------------------------------
  // Push notification handler (optional)
  // ---------------------------------------------------------------------------

  /**
   * Handle a push notification tap. Receives the notification data and router.
   * Return `true` if this module handled the notification (stops further routing).
   * Return `false` to let core or other modules handle it.
   */
  notificationHandler?: (data: Record<string, unknown>, router: Router) => boolean;
}
