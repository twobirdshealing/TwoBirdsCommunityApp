Community App — React Native (Expo), iOS + Android, built on WordPress + Fluent Community.

## About This Project

This is a white-label community app powered by [Fluent Community](https://fluentcommunity.co). It connects to your WordPress site and provides a native mobile experience for your community — feed, messaging, profiles, spaces, courses, and more.

## Documentation

| Resource | Location |
|---|---|
| **Setup Guide** | `setup/setup-guide.html` — Full walkthrough with screenshots |
| **Setup Dashboard** | `npm run dashboard` — Browser-based config UI at localhost:3456 |
| **Theme System** | `docs/theme-system.html` — Color tokens, Fluent CSS sync, usage rules |
| **Module System** | `docs/module-system.html` — Full reference with examples |
| **Per-Module Docs** | `docs/modules/` — Individual module setup & configuration |

## Quick Commands

| Command | What it does |
|---|---|
| `npm run dashboard` | Launch setup dashboard (browser UI for all configuration) |
| `npm run dev` | Start local dev server (production URL) |
| `npm run dev:staging` | Start local dev server (staging URL — shows red STAGING indicator in header) |
| `eas build --platform ios --profile production` | Build iOS via EAS |
| `eas build --platform android --profile production` | Build Android via EAS |
| `eas submit --platform ios --latest` | Submit latest iOS build to App Store Connect |
| `eas update --channel production --message "..."` | Push OTA update to production users (JS-layer only) |

## Core Files — Do Not Edit Without Permission

The following directories and files are **core** and will be **overwritten when you apply updates**:

- `app/` — Screen routes and navigation
- `components/` — Shared UI components
- `services/` — API clients, auth, push notifications
- `contexts/` — React context providers
- `hooks/` — Custom React hooks
- `utils/` — Utility functions
- `constants/colors.ts` — Theme color definitions (overridden by Fluent sync)

**Safe to edit** (protected during updates):
- `constants/config.ts` — Your app name, site URL
- `app.json` — Bundle IDs, EAS config, permissions
- `eas.json` — Build profiles, submit config
- `app.config.ts` — Fallback values
- `assets/images/` — Your branding assets
- `modules/` — Your custom modules

> **Warning:** If you modify core files, your changes will be lost when applying a core update. If you need custom behavior, build it as a module instead.

## Companion Plugins

The `companion plugins/` folder contains WordPress plugins and a theme that ship with the app. Install these on your WordPress site.

### Core Plugins (required)
- **tbc-community-app** — Main bridge plugin. All custom REST endpoints that the app uses to communicate with WordPress. Includes base registration endpoints (`tbc-ca/v1/auth/register/*`) that work with FC's native registration.
- **tbc-multi-reactions** — Multi-reaction support (like, love, laugh, etc.) for Fluent Community posts.

### Theme
- **tbc-starter-theme** — WordPress theme that provides the app's web companion views and color sync endpoint.

### Add-on Modules with Companion Plugins (sold separately)

Each add-on is a **paired module + plugin**: the app module lives in `modules/`, and its companion WordPress plugin lives in `companion plugins/`. Both are required for the feature to work.

- **tbc-otp** (plugin) + **otp module** — Phone OTP verification via Twilio. Adds a pre-creation registration step. Endpoints at `tbc-otp/v1`.
- **tbc-profile-completion** (plugin) + **profile-completion module** — Profile completion gate. Requires bio and/or avatar after registration. Uses response header detection. Endpoints at `tbc-pcom/v1`.


## Module System

Self-contained features that plug into the app without touching core code. Each module registers any combination of: bottom tabs, home widgets, launcher items, header icons, context providers, tab bar addons, registration steps, response headers, route prefixes, UI slots.

- **Define** a manifest in `modules/yourmodule/module.ts`
- **Register** in `modules/_registry.ts` (one line to enable/disable)
- **Route stub** in `app/(tabs)/` (one-line re-export, only if module has a tab)
- **Companion plugin** in `companion plugins/` (if module needs a WordPress backend)

Core features (feed, spaces, profiles, messaging, courses) are controlled by feature flags in wp-admin → TBC Community App → Features tab. The app fetches them via `/app-config` on startup (see `AppConfigContext` + `useFeatures` hook). Modules are for self-contained add-ons that go beyond core.

## Import Rules — Direct Imports Only

**No barrel files (`index.ts` re-exports).** Always import directly from the source file. Metro bundler doesn't tree-shake — barrel imports force it to load every sibling module even when you only need one.

- `import { Avatar } from '@/components/common/Avatar'` — correct
- `import { Avatar } from '@/components/common'` — WRONG (barrel import)

Do NOT create `index.ts` barrel/re-export files in any directory.

## Theme System — Fluent Community Color Sync

Full reference: `docs/theme-system.html`

Quick rules:
- **Always** use `const { colors } = useTheme()` — never import `lightColors`/`darkColors` directly
- Use `colors.textInverse` for text on colored buttons — NOT `#fff`
- Use semantic tokens (`colors.error`, `colors.success`) — NOT hex literals
- Use `colors.overlay` for modal/sheet backdrops — NOT `rgba(0,0,0,0.5)`
- Use `withOpacity(color, opacity)` from `@/constants/colors` for transparent variants

## App Version Bumping

Update all 4 places when bumping:

1. `package.json` → `version`
2. `app.json` → `expo.version`
3. `app.json` → `ios.buildNumber` (string, e.g. `"3.0.1"`)
4. `app.json` → `android.versionCode` (integer, pattern: `major*100 + minor*10 + patch`)

Or use the version bump buttons in the setup dashboard.

## OTA Updates vs New Build

The app uses `expo-updates` for over-the-air updates. **OTA can only update the JS bundle** — anything that touches native code requires a full EAS build + store submission.

**OTA is sufficient (push via `eas update` or dashboard OTA tab):**
- Any change to JS/TS files (screens, components, hooks, services, utils, modules)
- Style changes, text changes, new images imported via `require()`
- Bug fixes in React/JS logic
- Adding/removing/editing modules (JS-only)
- Config changes in `constants/config.ts`

**Requires a new native build (`eas build`):**
- Adding or removing a package in `package.json` that includes native code (anything with `ios/` or `android/` folders, or an Expo config plugin)
- Changing `app.json` fields that affect native config: bundle ID, permissions, plugins array, splash screen, icons, scheme, `expo-build-properties`
- Changing `eas.json` build profiles
- Bumping `expo` SDK version
- Any change to `app.config.ts` that feeds into native builds

**Rule of thumb:** If the change only touches `.ts`/`.tsx`/`.js` files and doesn't add native dependencies, OTA is fine. If you're unsure, check whether the package has an Expo config plugin or native code — if yes, new build needed.

After completing a task, tell the user whether their change is OTA-safe or requires a new build.

## Development & Debugging

- **Dev client**: App uses `expo-dev-client` (NOT Expo Go). After adding native modules, a new dev client build is needed via EAS.
- **Logging**: Use `createLogger(tag)` from `@/utils/logger` for all debug logging. Zero-cost in production.
  ```ts
  const log = createLogger('Pusher');
  log('connected');        // [Pusher] connected
  log.warn('reconnecting'); // [Pusher] reconnecting
  log.error('failed', err); // [Pusher] failed <error>
  ```
- **`__DEV__` checks**: Used for dev-only validation. Never wrap user-facing logic in `__DEV__`.

## General Rules

- Do not create new dependencies or utilities without checking the project first — there may already be centralized functions for what you need.
- Don't guess or make up APIs — always check existing endpoints and services first.
- When working on companion plugins, update the version number and changelog after changes.

---

<!-- ====================================================================== -->
<!-- Your Instructions — Add project-specific notes and preferences below  -->
<!-- Everything below this marker is stripped from white-label snapshots    -->
<!-- CUSTOM_INSTRUCTIONS_BELOW -->

## Site: Two Birds Church

Site: https://community.twobirdschurch.com
Dev brand: Two Birds Code (twobirdscode.com) — TBC

### Dev Workflow

**This repo is both our live production app AND the development source for the white-label product.** All coding happens here. When we hit a milestone, we run `npm run snapshot` to generate a clean snapshot at `../TBC-Community-App (White Lable)/` with site-specific values replaced by placeholders. Never edit the white-label folder directly — it gets overwritten each snapshot.

**Architecture goal:** Keep core clean, fast, and stable — only update it for Fluent Community compatibility. New features go in as modules so they don't interfere with core code.

> **Buyer-facing setup documentation lives in `setup/setup-guide.html`.**
> When making changes to config files, module system, or plugin structure, keep docs in sync.

### Additional Quick Commands

| Command | What it does |
|---|---|
| `npm run snapshot` | Create white-label snapshot (`bash scripts/create-white-label.sh`) |

### Add-on Modules

Blog module — available as a paid add-on, not part of the snapshot.

Book Club module — available as a paid add-on, not part of the snapshot.

YouTube module — available as a paid add-on, not part of the snapshot.

### Site-Specific Modules (not sold)

Calendar module — custom to Two Birds Church, not a public add-on.

Donate module — custom to Two Birds Church, not a public add-on.

Donor module — custom to Two Birds Church, not a public add-on.

Admin module — custom to Two Birds Church, not a public add-on.

### Site-Specific Companion Plugins

- **tbc-youtube** — YouTube channel integration with server-side caching (companion to youtube module)
- **tbc-book-club** — Book club audiobook player with meetings (companion to bookclub module)
- **tbc-calendar-fluent** — Our private calendar plugin that links to the calendar module

### Site-Specific Plugins (not in repo — on server only)
Donation addons, donor dashboard, messaging center, checkout prerequisites, participant frontend, space manager, bulk tools, entry review — these are Two Birds Church site-specific and not part of the product. We occasionally bring them into the companion folder for reference.

### White-Label Snapshot

After a version bump, ask the user if we should create a new white-label snapshot.

The snapshot script copies this app to the white-label folder with all site-specific values replaced by generic placeholders. It does NOT modify this repo — only writes to the target folder.

**To run:** `npm run snapshot`

**What it does:**
1. Copies project to `../TBC-Community-App (White Lable)/` (excludes node_modules, .git, modules, companion plugins)
2. Copies only core companion plugins (allowlist: tbc-community-app, tbc-multi-reactions, tbc-starter-theme)
3. Copies only module infrastructure (`_registry.ts`, `_types.ts`) — no module folders
4. Replaces Two Birds-specific values with placeholders in config.ts, app.json, eas.json, app.config.ts, package.json
5. Removes Firebase configs, adds FIREBASE_SETUP.md guide
6. Strips site-specific section from CLAUDE.md
7. Verifies no site-specific references remain

**What ships in the base white-label product:**
- Core app (all screens, services, components)
- Core companion plugins: tbc-community-app, tbc-multi-reactions, tbc-starter-theme

**Sold separately as add-ons (NOT in white-label):**
- tbc-otp plugin (phone OTP verification), tbc-profile-completion plugin (profile completion gate)
- Blog module, YouTube module + tbc-youtube plugin, Book Club module + tbc-book-club plugin

**Two Birds site-specific (never sold):**
- Calendar, Donate, Donor modules

### Dev Rules

After fixes or completed tasks ask user if we want to run /simplify

When working on companion plugins after updates/fixes/changes, update the version number on the plugin or theme and update changelog. If changelog is missing add one. Always update version to bust cache even on small updates.

### Testing

Current test credentials — ask for fresh token:
```
curl -s -X POST "https://community.twobirdschurch.com/wp-json/tbc-ca/v1/auth/login" -H "Content-Type: application/json" -d '{"username":"bluejay","password":"sapo"}' | python3 -m json.tool
```

Don't try running commands yourself — give them to me and wait for response. If unsure, always ask for an API response to understand the full picture.

Server runs Ubuntu — use `python3` not `python` for curl JSON formatting (e.g. `| python3 -m json.tool`)

All agents run opus
