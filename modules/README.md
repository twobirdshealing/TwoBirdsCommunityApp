# Modules

Self-contained features that plug into the app without touching core code. Each module can register any combination of:

- **Bottom tabs** — full-screen tab in the tab bar
- **Home widgets** — cards on the home screen
- **Menu items** — entries in the avatar dropdown menu
- **Header icons** — icon buttons in the top navigation bar
- **Context providers** — app-level state providers
- **Tab bar addon** — persistent UI above the tab bar (e.g., mini player, cart bar)

## Checklist — Adding a Module

Every module needs these steps. Don't skip any or it won't work:

- [ ] **Create** `modules/yourmodule/module.ts` (manifest + folder structure)
- [ ] **Register** in `modules/_registry.ts` (import + add to MODULES array)
- [ ] **Route stub** in `app/(tabs)/yourmodule.tsx` (one-line re-export — only if module has a tab)
- [ ] **Deep links** *(optional)* — add one line to `app.config.ts` if your module handles URLs

> Duplicate module or widget IDs will trigger a console warning in dev mode.

---

## Step-by-Step Guide

### 1. Create the module folder

```
modules/
  mymodule/
    module.ts          ← manifest (required)
    screens/           ← full-screen tab components
    components/        ← shared UI components
    widgets/           ← home screen widgets
    hooks/             ← custom hooks
    services/          ← API calls
    types/             ← TypeScript types
```

### 2. Define the manifest (`module.ts`)

Pick and choose what your module needs — all fields except `id`, `name`, and `version` are optional.

```typescript
import type { ModuleManifest } from '@/modules/_types';
import MyModuleTab from './screens/MyModuleTab';
import { MyWidget } from './widgets/MyWidget';

export const myModule: ModuleManifest = {
  id: 'mymodule',
  name: 'My Module',
  version: '1.0.0',

  // Adds a bottom tab
  tab: {
    name: 'mymodule',           // must match the filename in app/(tabs)/
    title: 'My Module',
    icon: 'heart',              // Ionicon name (focused)
    iconOutline: 'heart-outline', // Ionicon name (unfocused)
    order: 50,                  // core tabs: Home=10, Activity=20, Spaces=30
    component: MyModuleTab,
    // tabColor: 'error',        // optional: theme color token override (e.g. 'error' for red)
    // tabBarIcon: ...,          // optional: custom icon component (overrides icon/iconOutline)
    // interceptPress: (router) => { ... }, // optional: override tab press behavior
  },

  // Adds home screen widgets
  widgets: [
    {
      id: 'my-widget',          // unique, stable — used as storage key
      title: 'My Widget',
      icon: 'heart-outline',
      seeAllRoute: '/(tabs)/mymodule',
      defaultEnabled: true,
      canDisable: true,
      externalWrapper: true,    // true = wrapped in HomeWidget, false = custom layout
      component: MyWidget,
    },
  ],

  // Adds items to the avatar dropdown menu
  menuItems: [
    {
      id: 'my-dashboard',
      label: 'My Dashboard',
      icon: 'grid-outline',
      route: '/my-dashboard',     // or { pathname: '/webview', params: { url: '...', title: '...' } }
      order: 60,
      hideMenuKey: 'my_dashboard', // server can hide this via hide_menu[]
    },
  ],

  // Adds icon buttons to the top header bar
  headerIcons: [
    {
      id: 'my-alerts',
      icon: 'alert-circle-outline',
      route: '/my-alerts',
      order: 25,                  // core: Messages=10, Notifications=20, Cart=30
      accessibilityLabel: 'My Alerts',
    },
  ],

  // Adds context providers to the app tree
  // providers: [{ id: 'mymodule', order: 100, component: MyProvider }],

  // Persistent UI above the tab bar (e.g., mini player, cart bar)
  // tabBarAddon: MyMiniPlayer,

  // Route prefixes for push notification / deep link validation
  routePrefixes: ['/mymodule'],

  // Metadata
  companionPlugin: 'my-wp-plugin',
  apiBase: '/wp-json/my-plugin/v1',
};
```

### 3. Add route stubs in `app/`

Expo Router requires real files for each route. Create thin one-liners:

```typescript
// Tab route — app/(tabs)/mymodule.tsx (only if module has a tab)
export { default } from '@/modules/mymodule/screens/MyModuleTab';

// Screen routes — app/mymodule/index.tsx, app/mymodule/[id].tsx (if module has standalone screens)
export { default } from '@/modules/mymodule/screens/MyModuleList';
export { default } from '@/modules/mymodule/screens/MyModuleDetail';
```

Modules that only register widgets, menu items, or header icons do NOT need route stubs.

> **No `_layout.tsx` changes needed.** Route stubs auto-discover with default options (`presentation: 'card'`, `headerShown: false`). Only add a `Stack.Screen` entry in `app/_layout.tsx` if your module needs custom screen options (e.g., `fullScreenModal` presentation).

### 4. Register the module in `_registry.ts`

```typescript
// modules/_registry.ts
import { myModule } from './mymodule/module';

export const MODULES: ModuleManifest[] = [
  calendarModule,
  myModule,        // ← add here
];
```

### 5. Deep links (optional)

If your module handles URLs, add one line to `app.config.ts`:

```typescript
// Under "Module deep links" comment
{ scheme: 'https', host: hostname, pathPrefix: '/mymodule/' },
```

That's it. The app wires everything up automatically.

---

## Module Examples

Different modules use different combinations:

```typescript
// Widget-only module (no tab, just home screen cards)
{ id: 'weather', widgets: [...] }

// Menu-only module (adds an item to the avatar dropdown)
{ id: 'donor', menuItems: [{ label: 'Donor Dashboard', icon: 'wallet-outline', route: '/donor', order: 70 }] }

// Header icon module (adds an icon to the top bar)
{ id: 'search', headerIcons: [{ icon: 'search-outline', route: '/search', order: 15 }] }

// Full module (tab + widgets + menu + header icon)
{ id: 'calendar', tab: {...}, widgets: [...], menuItems: [...], headerIcons: [...] }
```

---

## Module Manifest Reference

See `_types.ts` for full type definitions.

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | Unique module identifier |
| `name` | `string` | Yes | Display name |
| `version` | `string` | Yes | Semver version |
| `tab` | `TabRegistration` | No | Bottom tab config |
| `widgets` | `WidgetRegistration[]` | No | Home screen widgets |
| `menuItems` | `MenuItemRegistration[]` | No | Avatar dropdown menu items |
| `headerIcons` | `HeaderIconRegistration[]` | No | Top header icon buttons |
| `providers` | `ProviderRegistration[]` | No | Context providers |
| `tabBarAddon` | `React.ComponentType` | No | Persistent UI above tab bar |
| `routePrefixes` | `string[]` | No | Push notification / deep link route prefixes |
| `hideMenuKey` | `string` | No | Server-driven visibility key |
| `companionPlugin` | `string` | No | WordPress plugin slug |
| `apiBase` | `string` | No | Custom API base path |

## Widget Tips

- `id` must be unique and stable — changing it resets user preferences
- `featureFlag` — if set (e.g., `featureFlag: 'BOOK_CLUB'`), widget is excluded when that flag is `false` in `constants/config.ts`
- `externalWrapper: true` — the home screen wraps your widget in a card with header, "See all" link, etc.
- `externalWrapper: false` — your widget handles its own layout (useful for banners, full-bleed content)
- Widget components receive `{ refreshKey: number }` — re-fetch data when this changes

## Ordering

Core UI uses increments of 10. Place your module items between them:

**Bottom tabs:**

| Order | Tab |
|---|---|
| 10 | Home (core) |
| 20 | Activity (core) |
| 30 | Spaces (core) |
| 40 | Calendar (module) |
| 50+ | Your modules |
| 100 | Donate (module) |

**Header icons:**

| Order | Icon |
|---|---|
| 10 | Messages (core) |
| 20 | Notifications (core) |
| 30 | Cart (core) |
| 35+ | Your icons |

**Menu items:**

| Order | Item |
|---|---|
| 10-50 | Core items (Profile, Spaces, Directory, etc.) |
| 60+ | Your items |
| 90 | Privacy Policy, Dark Mode (core) |

## Server-Driven Visibility

Both `menuItems` and `headerIcons` support `hideMenuKey`. When the server includes that key in the `hide_menu[]` array, the item is automatically hidden. This lets site admins control module visibility without app updates.

## Using Core Services

Modules can import from core code using `@/` paths:

```typescript
import { request } from '@/services/api/client';     // authenticated API calls
import { useTheme } from '@/contexts/ThemeContext';   // theme colors
import { useAuth } from '@/contexts/AuthContext';     // current user
import { SITE_URL } from '@/constants/config';        // site URL
import { useTabContentPadding } from '@/contexts/BottomOffsetContext'; // scroll padding
```

### Module API Pattern

Each module constructs its own API base URL from `SITE_URL`. Do NOT add module-specific URLs to `constants/config.ts` — keep them inside the module:

```typescript
// modules/mymodule/services/mymoduleApi.ts
import { SITE_URL } from '@/constants/config';
import { request } from '@/services/api/client';

const API_BASE = `${SITE_URL}/wp-json/my-plugin/v1`;

export async function getItems() {
  return request('/items', { baseUrl: API_BASE });
}
```

## Existing Modules

- **Calendar** (`modules/calendar/`) — Events calendar with WooCommerce integration. Has a bottom tab + home widgets. Companion plugin: `tbc-calednar-fluent`.
- **Book Club** (`modules/bookclub/`) — Audiobook player with bookmarks and meeting schedule. Has a home widget + menu item + context provider (AudioPlayerContext) + tab bar addon (MiniPlayer). Fully self-contained — removing it from the registry leaves the app working perfectly. Companion plugin: `tbc-book-club`.
- **Donate** (`modules/donate/`) — Donation tab that opens a WebView. Uses `interceptPress` to redirect to `/webview` with the donation page URL. Custom animated heart icon via `tabBarIcon` and red color via `tabColor: 'error'`. No standalone screens or API.

## Tab Bar Addon

A module can register a `tabBarAddon` — a component that renders above the tab bar buttons. The tab bar automatically measures the addon's height and exposes it via `BottomOffsetContext`. Screens use `useTabContentPadding()` to get correct bottom padding (includes tab bar + safe area + addon height).

- Multiple modules can register addons — they stack vertically (dev mode logs when multiple are registered)
- Each addon component controls its own visibility (e.g., MiniPlayer returns `null` when no audio is playing)
- When all addons are hidden, the measured height is 0 — padding adjusts automatically

**Example:** The Book Club module registers `MiniPlayer` as its `tabBarAddon`. When a user plays an audiobook, the MiniPlayer slides in above the tab bar. All scrollable screens automatically get extra bottom padding.

## Core vs Module

The rule: if it's **self-contained content**, it goes in a module. Modules should be fully deletable — commenting out a module from `_registry.ts` must not crash the app.

Core provides generic hooks that modules can leverage:
- `useTabContentPadding()` — bottom padding for scrollable content (tab bar + safe area + addon height)
- `useBottomOffset()` — raw addon height only (if you need just the number)
- `ModuleProviders` — renders module-registered context providers in the app tree
