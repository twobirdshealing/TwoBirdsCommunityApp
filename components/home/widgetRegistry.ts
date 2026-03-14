// =============================================================================
// WIDGET REGISTRY - Configuration for all home screen widgets
// =============================================================================
// Core widgets are defined here. Module widgets are registered via their
// module manifest in modules/_registry.ts and merged automatically.
// Both use the same WidgetRegistration type from modules/_types.ts.
// =============================================================================

import { FEATURES } from '@/constants/config';
import type { WidgetRegistration } from '@/modules/_types';
import { getModuleWidgets } from '@/modules/_registry';
import { YouTubeWidget } from '@/components/home/YouTubeWidget';
import { BlogWidget } from '@/components/home/BlogWidget';
import { CoursesWidget } from '@/components/home/CoursesWidget';

// -----------------------------------------------------------------------------
// Core Widget Registry (non-module widgets)
// -----------------------------------------------------------------------------

const CORE_WIDGETS: WidgetRegistration[] = [
  {
    id: 'latest-youtube',
    title: 'YouTube',
    icon: 'logo-youtube',
    seeAllRoute: '/youtube',
    featureFlag: 'YOUTUBE',
    defaultEnabled: true,
    canDisable: true,
    externalWrapper: true,
    component: YouTubeWidget,
  },
  {
    id: 'latest-blog',
    title: 'Latest Blog',
    icon: 'newspaper-outline',
    seeAllRoute: '/blog',
    defaultEnabled: true,
    canDisable: true,
    externalWrapper: true,
    component: BlogWidget,
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
    component: CoursesWidget,
  },
];

// -----------------------------------------------------------------------------
// Merged Registry (core + module widgets)
// -----------------------------------------------------------------------------

/** Full widget registry — core widgets first, then module widgets */
export const WIDGET_REGISTRY: WidgetRegistration[] = [
  ...CORE_WIDGETS,
  ...getModuleWidgets(),
];

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Get the subset of widgets that pass their feature flag check */
export function getAvailableWidgets(): WidgetRegistration[] {
  return WIDGET_REGISTRY.filter((w) => {
    if (w.featureFlag) {
      return FEATURES[w.featureFlag] === true;
    }
    return true;
  });
}

/** Core widget component map (id → component) for home screen */
export function getCoreWidgetComponentMap(): Record<
  string,
  React.ComponentType<{ refreshKey: number }>
> {
  const map: Record<string, React.ComponentType<{ refreshKey: number }>> = {};
  for (const w of CORE_WIDGETS) {
    map[w.id] = w.component;
  }
  return map;
}
