// =============================================================================
// WIDGET REGISTRY - Configuration for all home screen widgets
// =============================================================================
// Core widgets are defined here. Module widgets are registered via their
// module manifest in modules/_registry.ts and merged automatically.
// Both use the same WidgetRegistration type from modules/_types.ts.
// =============================================================================

import type { FeaturesConfig } from '@/services/api/appConfig';
import type { WidgetRegistration } from '@/modules/_types';
import { getModuleWidgets } from '@/modules/_registry';
import { CoursesWidget } from '@/components/home/CoursesWidget';

// -----------------------------------------------------------------------------
// Core Widget Registry (non-module widgets)
// -----------------------------------------------------------------------------

const CORE_WIDGETS: WidgetRegistration[] = [
  {
    id: 'my-courses',
    title: 'My Courses',
    icon: 'school-outline',
    seeAllRoute: '/courses',
    featureFlag: 'courses',
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
export function getAvailableWidgets(features: FeaturesConfig): WidgetRegistration[] {
  return WIDGET_REGISTRY.filter((w) => {
    if (w.featureFlag) {
      return features[w.featureFlag] === true;
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
