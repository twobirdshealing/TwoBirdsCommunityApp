// =============================================================================
// WIDGET REGISTRY - Configuration for all home screen widgets
// =============================================================================
// Core widgets are defined here. Module widgets are registered via their
// module manifest in modules/_registry.ts and merged automatically.
// =============================================================================

import { Ionicons } from '@expo/vector-icons';
import { FEATURES } from '@/constants/config';
import { getModuleWidgets } from '@/modules/_registry';

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
// Core Widget Registry (non-module widgets)
// -----------------------------------------------------------------------------

const CORE_WIDGETS: WidgetConfig[] = [
  {
    id: 'latest-youtube',
    title: 'YouTube',
    icon: 'logo-youtube',
    seeAllRoute: '/youtube',
    featureFlag: 'YOUTUBE',
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
    id: 'my-courses',
    title: 'My Courses',
    icon: 'school-outline',
    seeAllRoute: '/courses',
    featureFlag: 'COURSES',
    defaultEnabled: true,
    canDisable: true,
    externalWrapper: true,
  },
];

// -----------------------------------------------------------------------------
// Merged Registry (core + module widgets)
// -----------------------------------------------------------------------------

/** Full widget registry — core widgets first, then module widgets */
export const WIDGET_REGISTRY: WidgetConfig[] = [
  ...CORE_WIDGETS,
  ...getModuleWidgets(),
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
