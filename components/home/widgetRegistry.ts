// =============================================================================
// WIDGET REGISTRY - Configuration for all home screen widgets
// =============================================================================
// Core widgets are defined here. Module widgets are registered via their
// module manifest in modules/_registry.ts and merged automatically.
// Both use the same WidgetRegistration type from modules/_types.ts.
// =============================================================================

import type { FeaturesConfig } from '@/services/api/appConfig';
import type { WidgetRegistration, WidgetComponentProps } from '@/modules/_types';
import { getModuleWidgets } from '@/modules/_registry';
import { CoursesWidget } from '@/components/home/CoursesWidget';
import { isItemHidden } from '@/utils/visibility';

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
    component: CoursesWidget,
    hideKey: 'courses',
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

/** Get the subset of widgets that pass their feature flag and visibility checks */
export function getAvailableWidgets(features: FeaturesConfig, hideMenu: string[] = []): WidgetRegistration[] {
  return WIDGET_REGISTRY.filter((w) => {
    if (w.featureFlag && features[w.featureFlag] !== true) return false;
    if (isItemHidden(hideMenu, w.hideKey)) return false;
    return true;
  });
}

/** Core widget component map (id → component) for home screen */
export function getCoreWidgetComponentMap(): Record<
  string,
  React.ComponentType<WidgetComponentProps>
> {
  const map: Record<string, React.ComponentType<WidgetComponentProps>> = {};
  for (const w of CORE_WIDGETS) {
    map[w.id] = w.component;
  }
  return map;
}
