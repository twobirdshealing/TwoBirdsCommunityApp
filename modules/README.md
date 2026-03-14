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
- [ ] **WP visibility** *(optional)* — add a Custom Visibility Element in WP admin (Settings > UI Visibility) if you want per-role hiding

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
    hideMenuKey: 'mymodule',    // server can hide this tab via hide_menu[]
    // tabColor: 'error',       // optional: theme color token override (e.g. 'error' for red)
    // tabBarIcon: ...,         // optional: custom icon component (overrides icon/iconOutline)
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
      // iconColor: 'error',      // optional: theme color token override (defaults to textSecondary)
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
      hideMenuKey: 'my_alerts',   // server can hide this via hide_menu[]
    },
  ],

  // Adds context providers to the app tree
  // providers: [{ id: 'mymodule', order: 100, component: MyProvider }],

  // Persistent UI above the tab bar (e.g., mini player, cart bar)
  // tabBarAddon: MyMiniPlayer,

  // Route prefixes for push notification / deep link validation
  routePrefixes: ['/mymodule'],

  // Module-level hideMenuKey — inherited by tab if tab doesn't set its own
  hideMenuKey: 'mymodule',

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

### 6. Server-driven visibility (optional)

To let site admins hide your module per-role without an app update:

1. Set `hideMenuKey` on your tab, menu items, and/or header icons (e.g., `hideMenuKey: 'mymodule'`)
2. In WordPress admin, go to **TBC Community App > Settings > UI Visibility**
3. Click **+ Add Element** under "Custom Visibility Elements"
4. Enter the key (must match `hideMenuKey`) and a label (shown as column header)
5. Save, then check the boxes for roles that should NOT see it

The key flows: **WP admin checkbox → `tbc_ca_settings` → REST API `/app-config` → `visibility.hide_menu[]` → app hides matching tabs/menu items/header icons**

That's it. The app wires everything up automatically.

---

## Toggling Modules

There are two ways to disable a module:

### Compile-time: Remove from registry

Comment out or delete the module from `_registry.ts`. The module code stays in the repo but is never loaded. Use this when a buyer doesn't need the feature at all.

```typescript
export const MODULES: ModuleManifest[] = [
  calendarModule,
  // bookclubModule,  ← disabled
  donateModule,
];
```

### Runtime: Server-driven visibility (`hideMenuKey`)

The module is still loaded but hidden for specific roles. Use this for per-role access control (e.g., hide Donate tab from non-members). Set up via WordPress admin panel — no app update needed.

### Feature flags (`constants/config.ts`)

Feature flags like `FEATURES.CART`, `FEATURES.YOUTUBE`, `FEATURES.COURSES` are for **core features only** — things baked into the app that aren't modules. Do NOT add feature flags for modules — toggle them via the registry instead.

---

## Module Examples

Different modules use different combinations:

```typescript
// Widget-only module (no tab, just home screen cards)
{ id: 'weather', widgets: [...] }

// Menu-only module (adds an item to the avatar dropdown)
{ id: 'donor', menuItems: [{ label: 'Donor Dashboard', icon: 'wallet-outline', route: { pathname: '/webview', params: { url: '...', title: '...' } }, order: 65 }] }

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
| `hideMenuKey` | `string` | No | Server-driven visibility key (inherited by tab if tab doesn't set its own) |
| `companionPlugin` | `string` | No | WordPress plugin slug |
| `apiBase` | `string` | No | Custom API base path |

### Tab options

| Field | Type | Description |
|---|---|---|
| `name` | `string` | Must match filename in `app/(tabs)/` |
| `title` | `string` | Tab label |
| `icon` / `iconOutline` | `string` | Ionicon names for focused/unfocused states |
| `order` | `number` | Sort order (core: 10-30, modules: 40+) |
| `component` | `ComponentType` | Screen component |
| `hideMenuKey` | `string` | Server visibility key — tab hidden when this key is in `hide_menu[]` |
| `tabColor` | `string` | Theme color token override (e.g., `'error'` for red). Applied regardless of focus state |
| `tabBarIcon` | `function` | Custom icon renderer — overrides `icon`/`iconOutline` |
| `interceptPress` | `function` | Override tab press (e.g., open WebView instead of navigating) |

### Menu item options

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier |
| `label` | `string` | Display text |
| `icon` | `string` | Ionicon name |
| `route` | `string \| object` | Navigation target (string path or `{ pathname, params }` for WebView) |
| `order` | `number` | Sort order (core: 10-50, modules: 60+) |
| `hideMenuKey` | `string` | Server visibility key |
| `iconColor` | `string` | Theme color token override (e.g., `'error'` for red). Defaults to `textSecondary` |

### Header icon options

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique identifier |
| `icon` | `string` | Ionicon name |
| `route` | `string` | Navigation target |
| `order` | `number` | Sort order (core: 10-30, modules: 35+) |
| `accessibilityLabel` | `string` | Screen reader label |
| `hideMenuKey` | `string` | Server visibility key |

## Widget Tips

- `id` must be unique and stable — changing it resets user preferences
- `featureFlag` — if set (e.g., `featureFlag: 'COURSES'`), widget is excluded when that flag is `false` in `constants/config.ts`. Only use for core widgets, not module widgets
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
| 55 | Book Club (module) |
| 60 | Donate (module) |
| 65 | Donor Dashboard (module) |
| 70+ | Your items |
| 90 | Privacy Policy, Dark Mode (core) |

## Server-Driven Visibility

Tabs, menu items, and header icons all support `hideMenuKey`. When the server includes that key in the `hide_menu[]` array (via the `/app-config` endpoint), the item is automatically hidden. This lets site admins control module visibility per-role without app updates.

**How it works in the app:**
- **Tabs** — the custom tab bar filters out routes whose `hideMenuKey` is in `hide_menu[]`
- **Menu items** — `UserMenu` checks `hideMenuKey` before rendering each module menu item
- **Header icons** — `TopHeader` checks `hideMenuKey` before rendering each module icon

**WordPress admin setup:**
1. Go to **TBC Community App > Settings > UI Visibility**
2. Core items (Cart, Blog, Courses, etc.) are always shown
3. For module items, click **+ Add Element** under "Custom Visibility Elements"
4. Enter the `hideMenuKey` value and a human-readable label
5. Save — the new column appears in the visibility table
6. Check the box for any role that should NOT see that item

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

If your module has its own companion WordPress plugin, construct the API base URL from `SITE_URL` inside the module. Do NOT add module-specific URLs to `constants/config.ts` — keep them inside the module:

```typescript
// modules/mymodule/services/mymoduleApi.ts
import { SITE_URL } from '@/constants/config';
import { request } from '@/services/api/client';

const API_BASE = `${SITE_URL}/wp-json/my-plugin/v1`;

export async function getItems() {
  return request('/items', { baseUrl: API_BASE });
}
```

If your module's API lives in the core plugin (`tbc-community-app`), the API service stays in `services/api/` (core) and your module imports it from there.

## Existing Modules

| Module | Folder | Tab | Widget | Menu | Header | Addon | Plugin |
|---|---|---|---|---|---|---|---|
| Calendar | `modules/calendar/` | Yes (order 40) | Ceremony, Events | — | — | — | `tbc-calednar-fluent` |
| Book Club | `modules/bookclub/` | — | BookClub | Yes | — | MiniPlayer | `tbc-book-club` |
| Donate | `modules/donate/` | Yes (order 100) | — | Yes | — | — | — (WebView) |
| Donor Dashboard | `modules/donor/` | — | — | Yes | — | — | — (WebView) |

### Calendar
Events calendar with WooCommerce integration. Bottom tab + two home widgets (upcoming booking, featured events). Companion plugin: `tbc-calednar-fluent`.

### Book Club
Audiobook player with bookmarks and meeting schedule. Home widget + menu item + context provider (`AudioPlayerContext`) + tab bar addon (`MiniPlayer`). Fully self-contained — removing it from the registry leaves the app working perfectly. Companion plugin: `tbc-book-club`.

### Donate
Donation tab that opens a WebView. Uses `interceptPress` to redirect to `/webview` with the donation page URL. Custom animated heart icon via `tabBarIcon` and red color via `tabColor: 'error'`. Also registers a menu item with `iconColor: 'error'` for a red heart in the dropdown. No standalone screens or API.

### Donor Dashboard
Menu-only module — adds "Donor Dashboard" to the avatar dropdown, opens a WebView. No tab, no widget, no API.

## Tab Bar Addon

A module can register a `tabBarAddon` — a component that renders above the tab bar buttons. The tab bar automatically measures the addon's height and exposes it via `BottomOffsetContext`. Screens use `useTabContentPadding()` to get correct bottom padding (includes tab bar + safe area + addon height).

- Multiple modules can register addons — they stack vertically (dev mode logs when multiple are registered)
- Each addon component controls its own visibility (e.g., MiniPlayer returns `null` when no audio is playing)
- When all addons are hidden, the measured height is 0 — padding adjusts automatically

**Example:** The Book Club module registers `MiniPlayer` as its `tabBarAddon`. When a user plays an audiobook, the MiniPlayer slides in above the tab bar. All scrollable screens automatically get extra bottom padding.

## Core vs Module

The rule: if it's **self-contained content**, it goes in a module. Modules should be fully deletable — commenting out a module from `_registry.ts` must not crash the app.

**Core features** (not modules) include: feed, spaces, profiles, notifications, messaging, courses, blog, YouTube, cart. These are tightly integrated with the app's API client, auth system, or response headers. They use `FEATURES.*` flags in `constants/config.ts` for compile-time toggling.

**Modules** include: calendar, book club, donate, donor dashboard. These are self-contained, have their own companion plugins (or just open WebViews), and can be removed by deleting one line from `_registry.ts`.

Core provides generic hooks that modules can leverage:
- `useTabContentPadding()` — bottom padding for scrollable content (tab bar + safe area + addon height)
- `useBottomOffset()` — raw addon height only (if you need just the number)
- `ModuleProviders` — renders module-registered context providers in the app tree
