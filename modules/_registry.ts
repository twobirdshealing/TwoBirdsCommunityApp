// =============================================================================
// MODULE REGISTRY - Active modules for this app
// =============================================================================
// SETUP: Edit this to add/remove modules.
// For branding and features, edit constants/config.ts
//
// Each module must also have a thin route stub in app/ (see module README).
// =============================================================================

import type { Router } from 'expo-router';
import { registerCache } from '@/services/cacheRegistry';
import type {
  ModuleManifest,
  TabRegistration,
  WidgetRegistration,
  ProviderRegistration,
  MenuItemRegistration,
  HeaderIconRegistration,
} from './_types';

// =============================================================================
// YOUR MODULES — Import and register your modules below.
// This section is yours to edit. Core updates won't touch it.
// =============================================================================

import { calendarModule } from './calendar/module';
import { bookclubModule } from './bookclub/module';
import { donateModule } from './donate/module';
import { donorModule } from './donor/module';
import { youtubeModule } from './youtube/module';
import { blogModule } from './blog/module';

export const MODULES: ModuleManifest[] = [
  calendarModule,
  bookclubModule,
  donateModule,
  donorModule,
  youtubeModule,
  blogModule,
];

// =============================================================================
// END YOUR MODULES — Everything below is core. Do not edit.
// =============================================================================

// -----------------------------------------------------------------------------
// Dev-mode validation — catches common setup mistakes
// -----------------------------------------------------------------------------

if (__DEV__) {
  const ids = MODULES.map((m) => m.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) {
    console.warn(`[Modules] Duplicate module IDs: ${dupes.join(', ')}`);
  }

  const widgetIds = MODULES.flatMap((m) => (m.widgets ?? []).map((w) => w.id));
  const widgetDupes = widgetIds.filter((id, i) => widgetIds.indexOf(id) !== i);
  if (widgetDupes.length) {
    console.warn(`[Modules] Duplicate widget IDs: ${widgetDupes.join(', ')}`);
  }

  const addonCount = MODULES.filter((m) => m.tabBarAddon).length;
  if (addonCount > 1) {
    console.warn(`[Modules] ${addonCount} tabBarAddon registrations — they will stack vertically`);
  }
}

// -----------------------------------------------------------------------------
// Derived registrations (consumed by core code)
// -----------------------------------------------------------------------------

/** All module tabs, sorted by order (inherits module-level hideMenuKey onto tab) */
export function getModuleTabs(): TabRegistration[] {
  return MODULES
    .filter((m) => m.tab)
    .map((m) => ({
      ...m.tab!,
      hideMenuKey: m.tab!.hideMenuKey ?? m.hideMenuKey,
    }))
    .sort((a, b) => a.order - b.order);
}

/** All module widgets (flat list from all modules) */
export function getModuleWidgets(): WidgetRegistration[] {
  return MODULES.flatMap((m) => m.widgets ?? []);
}

/** All module context providers, sorted by order */
export function getModuleProviders(): ProviderRegistration[] {
  return MODULES
    .flatMap((m) => m.providers ?? [])
    .sort((a, b) => a.order - b.order);
}

/** All module menu items for UserMenu dropdown, sorted by order */
export function getModuleMenuItems(): MenuItemRegistration[] {
  return MODULES
    .flatMap((m) => m.menuItems ?? [])
    .sort((a, b) => a.order - b.order);
}

/** All module header icons for TopHeader, sorted by order */
export function getModuleHeaderIcons(): HeaderIconRegistration[] {
  return MODULES
    .flatMap((m) => m.headerIcons ?? [])
    .sort((a, b) => a.order - b.order);
}

/** All tab bar addon components (stacked vertically above tab buttons) */
export function getTabBarAddons(): React.ComponentType[] {
  return MODULES
    .filter((m) => m.tabBarAddon)
    .map((m) => m.tabBarAddon!);
}

/** All module route prefixes for push notification / deep link validation */
export function getModuleRoutePrefixes(): string[] {
  return MODULES.flatMap((m) => m.routePrefixes ?? []);
}

// -----------------------------------------------------------------------------
// Lifecycle hooks (called by _layout.tsx)
// -----------------------------------------------------------------------------

/** Call onInit() on all modules (fire-and-forget, errors logged not thrown) */
export async function initModules(): Promise<void> {
  for (const mod of MODULES) {
    try {
      await mod.onInit?.();
    } catch (e) {
      if (__DEV__) console.warn(`[Modules] ${mod.id} onInit failed:`, e);
    }
  }
}

/** Call onCleanup() on all modules (e.g. on logout) */
export function cleanupModules(): void {
  for (const mod of MODULES) {
    try {
      mod.onCleanup?.();
    } catch (e) {
      if (__DEV__) console.warn(`[Modules] ${mod.id} onCleanup failed:`, e);
    }
  }
}

// Self-register so module cleanup runs automatically on logout
registerCache({ clearMemory: cleanupModules });

// -----------------------------------------------------------------------------
// Push notification handler (called by _layout.tsx)
// -----------------------------------------------------------------------------

/**
 * Let modules handle a push notification tap.
 * Returns true if any module handled it, false to fall through to core routing.
 */
export function handleModuleNotification(
  data: Record<string, unknown>,
  router: Router
): boolean {
  for (const mod of MODULES) {
    if (mod.notificationHandler?.(data, router)) return true;
  }
  return false;
}

/** Widget component map (id → component) for home screen */
export function getWidgetComponentMap(): Record<
  string,
  React.ComponentType<{ refreshKey: number }>
> {
  const map: Record<string, React.ComponentType<{ refreshKey: number }>> = {};
  for (const w of getModuleWidgets()) {
    map[w.id] = w.component;
  }
  return map;
}
