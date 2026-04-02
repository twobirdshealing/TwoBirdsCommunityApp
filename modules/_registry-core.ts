// =============================================================================
// MODULE REGISTRY CORE - Infrastructure functions for the module system
// =============================================================================
// This file is CORE — it gets overwritten on updates. Do not edit.
// For module registration (imports + MODULES array), edit _registry.ts.
// =============================================================================

import type { Router } from 'expo-router';
import { registerCache } from '@/services/cacheRegistry';
import { registerModuleResponseHeaders } from '@/services/api/client';
import type {
  ModuleManifest,
  TabRegistration,
  WidgetRegistration,
  WidgetComponentProps,
  ProviderRegistration,
  LauncherItemRegistration,
  HeaderIconRegistration,
  RegistrationStepRegistration,
  ResponseHeaderMapping,
  SlotName,
} from './_types';

// -----------------------------------------------------------------------------
// Module storage — _registry.ts calls setModules() to inject the array.
// This avoids a circular dependency (_registry.ts re-exports from this file).
// -----------------------------------------------------------------------------

let _modules: ModuleManifest[] = [];

/** Called by _registry.ts to inject the MODULES array. Do not call elsewhere. */
export function setModules(modules: ModuleManifest[]): void {
  _modules = modules;

  // Register response headers now that modules are available
  _cachedResponseHeaders = _modules.flatMap((m) => m.responseHeaders ?? []);
  registerModuleResponseHeaders(_cachedResponseHeaders);

  // Dev-mode validation — catches common setup mistakes
  if (__DEV__) {
    const ids = _modules.map((m) => m.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length) {
      console.warn(`[Modules] Duplicate module IDs: ${dupes.join(', ')}`);
    }

    const widgetIds = _modules.flatMap((m) => (m.widgets ?? []).map((w) => w.id));
    const widgetDupes = widgetIds.filter((id, i) => widgetIds.indexOf(id) !== i);
    if (widgetDupes.length) {
      console.warn(`[Modules] Duplicate widget IDs: ${widgetDupes.join(', ')}`);
    }

    const addonCount = _modules.filter((m) => m.tabBarAddon).length;
    if (addonCount > 1) {
      console.warn(`[Modules] ${addonCount} tabBarAddon registrations — they will stack vertically`);
    }

    const slotNames = _modules.flatMap((m) => (m.slots ?? []).map((s) => s.slot));
    const slotDupes = slotNames.filter((s, i) => slotNames.indexOf(s) !== i);
    if (slotDupes.length) {
      console.warn(`[Modules] Multiple modules fill the same slot: ${[...new Set(slotDupes)].join(', ')} — lowest priority wins`);
    }
  }
}

// -----------------------------------------------------------------------------
// Derived registrations (consumed by core code)
// -----------------------------------------------------------------------------

/** All module tabs, sorted by order (inherits module-level hideMenuKey onto tab) */
export function getModuleTabs(): TabRegistration[] {
  return _modules
    .filter((m) => m.tab)
    .map((m) => ({
      ...m.tab!,
      hideMenuKey: m.tab!.hideMenuKey ?? m.hideMenuKey,
    }))
    .sort((a, b) => a.order - b.order);
}

/** All module widgets (flat list from all modules) */
export function getModuleWidgets(): WidgetRegistration[] {
  return _modules.flatMap((m) => m.widgets ?? []);
}

/** All module context providers, sorted by order */
export function getModuleProviders(): ProviderRegistration[] {
  return _modules
    .flatMap((m) => m.providers ?? [])
    .sort((a, b) => a.order - b.order);
}

/** All module launcher items for the Launcher bottom sheet, sorted by order */
export function getLauncherItems(): LauncherItemRegistration[] {
  return _modules
    .flatMap((m) => m.launcherItems ?? [])
    .sort((a, b) => a.order - b.order);
}

/** All module header icons for TopHeader, sorted by order */
export function getModuleHeaderIcons(): HeaderIconRegistration[] {
  return _modules
    .flatMap((m) => m.headerIcons ?? [])
    .sort((a, b) => a.order - b.order);
}

/** All tab bar addon components (stacked vertically above tab buttons) */
export function getTabBarAddons(): React.ComponentType[] {
  return _modules
    .filter((m) => m.tabBarAddon)
    .map((m) => m.tabBarAddon!);
}

/** All module route prefixes for push notification / deep link validation */
export function getModuleRoutePrefixes(): string[] {
  return _modules.flatMap((m) => m.routePrefixes ?? []);
}

/** All module response header mappings (consumed by API client for generic header extraction) */
let _cachedResponseHeaders: ResponseHeaderMapping[] = [];
export function getModuleResponseHeaders(): ResponseHeaderMapping[] {
  return _cachedResponseHeaders;
}

// -----------------------------------------------------------------------------
// Registration steps (core + module)
// -----------------------------------------------------------------------------

/**
 * Core registration steps — always available, not from modules.
 * Email verify is rendered directly by the register screen (it has its own
 * props interface), but registered here so getRegistrationSteps() includes it
 * for step counting and shouldActivate checks.
 */
const CORE_REGISTRATION_STEPS: RegistrationStepRegistration[] = [
  {
    id: 'email-verify',
    order: 10,
    phase: 'pre-creation',
    title: 'Verify Email',
    component: (() => null) as any, // Rendered directly by register screen, not via this component
    shouldActivate: ({ submitResponse }) =>
      !!submitResponse?.email_verification_required && !!submitResponse?.verification_token,
  },
];

/** All registration steps (core + module), sorted by order */
export function getRegistrationSteps(): RegistrationStepRegistration[] {
  return [
    ...CORE_REGISTRATION_STEPS,
    ..._modules.flatMap((m) => m.registrationSteps ?? []),
  ].sort((a, b) => a.order - b.order);
}

// -----------------------------------------------------------------------------
// Lifecycle hooks (called by _layout.tsx)
// -----------------------------------------------------------------------------

/** Call onInit() on all modules (fire-and-forget, errors logged not thrown) */
export async function initModules(): Promise<void> {
  for (const mod of _modules) {
    try {
      await mod.onInit?.();
    } catch (e) {
      if (__DEV__) console.warn(`[Modules] ${mod.id} onInit failed:`, e);
    }
  }
}

/** Call onCleanup() on all modules (e.g. on logout) */
export function cleanupModules(): void {
  for (const mod of _modules) {
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
  for (const mod of _modules) {
    if (mod.notificationHandler?.(data, router)) return true;
  }
  return false;
}

// -----------------------------------------------------------------------------
// Slot system (module-injected UI into core component areas)
// -----------------------------------------------------------------------------

/** Get the winning slot component for a named slot (lowest priority wins, null if none) */
export function getSlotComponent<P = any>(slotName: SlotName): React.ComponentType<P> | null {
  const registrations = _modules
    .flatMap((m) => m.slots ?? [])
    .filter((s) => s.slot === slotName)
    .sort((a, b) => a.priority - b.priority);
  return registrations[0]?.component ?? null;
}

// -----------------------------------------------------------------------------
// Widget component map
// -----------------------------------------------------------------------------

/** Widget component map (id → component) for home screen */
export function getWidgetComponentMap(): Record<
  string,
  React.ComponentType<WidgetComponentProps>
> {
  const map: Record<string, React.ComponentType<WidgetComponentProps>> = {};
  for (const w of getModuleWidgets()) {
    map[w.id] = w.component;
  }
  return map;
}
