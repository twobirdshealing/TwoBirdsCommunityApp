// =============================================================================
// MODULE REGISTRY - Active modules for this app
// =============================================================================
// SETUP: Edit this to add/remove modules.
// For branding and features, edit constants/config.ts
//
// Each module must also have a thin route stub in app/ (see module README).
// =============================================================================

import type { ModuleManifest } from './_types';
import { setModules } from './_registry-core';

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
import { otpModule } from './otp/module';
import { profileCompletionModule } from './profile-completion/module';
import { cartModule } from './cart/module';
import { multiReactionsModule } from './multi-reactions/module';


import { adminModule } from './admin/module';
export const MODULES: ModuleManifest[] = [
  calendarModule,
  bookclubModule,
  donateModule,
  donorModule,
  youtubeModule,
  blogModule,
  otpModule,
  profileCompletionModule,
  cartModule,
  multiReactionsModule,
  adminModule,
  adminModule,
];

// Inject modules into the core registry (no circular dependency — one-way flow)
setModules(MODULES);

// =============================================================================

// END YOUR MODULES — Everything below is core. Do not edit.
// =============================================================================

// Re-export all core registry functions from _registry-core.ts
// (_registry-core.ts is NOT protected — it gets overwritten on updates)
export * from './_registry-core';
