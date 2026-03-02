// =============================================================================
// WIDGET REGISTRY - Configuration for all home screen widgets
// =============================================================================
// Single source of truth for available widgets. Adding a new widget means
// adding one entry here + one component mapping in the home screen.
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import { FEATURES } from '@/constants/config';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface WidgetConfig {
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
}

// -----------------------------------------------------------------------------
// Registry
// -----------------------------------------------------------------------------

export const WIDGET_REGISTRY: WidgetConfig[] = [
  {
    id: 'featured-events',
    title: 'Featured Events',
    icon: 'calendar-outline',
    seeAllRoute: '/(tabs)/calendar',
    defaultEnabled: true,
    canDisable: true,
    externalWrapper: true,
  },
  {
    id: 'welcome-banner',
    title: 'Welcome Banner',
    defaultEnabled: true,
    canDisable: true,
    externalWrapper: false,
  },
  {
    id: 'my-courses',
    title: 'My Courses',
    icon: 'school-outline',
    seeAllRoute: '/courses',
    featureFlag: 'COURSES',
    defaultEnabled: true,
    canDisable: true,
    externalWrapper: true,
  },
  {
    id: 'book-club',
    title: 'Book Club',
    icon: 'book-outline',
    seeAllRoute: '/bookclub',
    featureFlag: 'BOOK_CLUB',
    defaultEnabled: true,
    canDisable: true,
    externalWrapper: true,
  },
  {
    id: 'latest-blog',
    title: 'Latest Blog',
    icon: 'newspaper-outline',
    seeAllRoute: '/blog',
    defaultEnabled: true,
    canDisable: true,
    externalWrapper: true,
  },
  {
    id: 'latest-youtube',
    title: 'YouTube',
    icon: 'logo-youtube',
    seeAllRoute: '/youtube',
    defaultEnabled: true,
    canDisable: true,
    externalWrapper: true,
  },
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Get the subset of widgets that pass their feature flag check */
export function getAvailableWidgets(): WidgetConfig[] {
  return WIDGET_REGISTRY.filter((w) => {
    if (w.featureFlag) {
      return FEATURES[w.featureFlag] === true;
    }
    return true;
  });
}
