// =============================================================================
// MODULE TYPES - Shared type definitions for the module system
// =============================================================================
// Modules are self-contained features (calendar, blog, etc.) that register
// their tabs, widgets, and providers via a manifest. Core code reads from
// the registry (_registry.ts) to wire everything together at build time.
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import { FEATURES } from '@/constants/config';

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
  tabColor?: string;
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
// Module Manifest
// -----------------------------------------------------------------------------

export interface ModuleManifest {
  /** Unique module ID */
  id: string;
  /** Human-readable module name */
  name: string;
  /** Module version (semver) */
  version: string;
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
}
