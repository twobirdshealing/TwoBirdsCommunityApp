// =============================================================================
// CALENDAR MODULE - Events calendar with WooCommerce integration
// =============================================================================
// Companion plugin: tbc-calendar-fluent (WordPress)
// API namespace: /wp-json/tbc-wc/v1
// =============================================================================

import type { ModuleManifest } from '@/modules/_types';
import CalendarTab from './screens/CalendarTab';
import { CeremonyWidget } from './widgets/CeremonyWidget';
import { EventsWidget } from './widgets/EventsWidget';

export const calendarModule: ModuleManifest = {
  id: 'calendar',
  name: 'Calendar',
  version: '1.0.0',

  tab: {
    name: 'calendar',
    title: 'Calendar',
    icon: 'calendar',
    iconOutline: 'calendar-outline',
    order: 40,
    component: CalendarTab,
  },

  widgets: [
    {
      id: 'upcoming-booking',
      title: 'Upcoming Booking',
      icon: 'flame-outline',
      seeAllRoute: '/(tabs)/calendar',
      defaultEnabled: true,
      canDisable: true,
      externalWrapper: true,
      component: CeremonyWidget,
    },
    {
      id: 'featured-events',
      title: 'Featured Events',
      icon: 'calendar-outline',
      seeAllRoute: '/(tabs)/calendar',
      defaultEnabled: true,
      canDisable: true,
      externalWrapper: true,
      component: EventsWidget,
    },
  ],

  hideMenuKey: 'calendar',
  companionPlugin: 'tbc-calendar-fluent',
  apiBase: '/wp-json/tbc-wc/v1',
};
