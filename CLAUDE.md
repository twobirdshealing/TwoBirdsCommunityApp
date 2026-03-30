Community App — React Native (Expo), iOS + Android, built on WordPress + Fluent Community.

## About This Project

This is a white-label community app powered by [Fluent Community](https://fluentcommunity.co). It connects to your WordPress site and provides a native mobile experience for your community — feed, messaging, profiles, spaces, courses, and more.

## Documentation

| Resource | Location |
|---|---|
| **Setup Guide** | `setup/setup-guide.html` — Full walkthrough with screenshots |
| **Setup Dashboard** | `npm run dashboard` — Browser-based config UI at localhost:3456 |
| **Architecture** | `setup/docs/architecture.html` — App structure, data flow, core systems |
| **Module System** | `setup/docs/module-system.html` — Full reference with examples |
| **Theme System** | `setup/docs/theme-system.html` — Color tokens, Fluent CSS sync, usage rules |
| **Companion Plugins** | `setup/docs/companion-plugins.html` — Plugin descriptions, endpoints, installation |
| **Logging** | `setup/docs/logging.html` — createLogger usage and conventions |
| **Per-Module Docs** | `setup/docs/modules/` — Individual module setup & configuration |
| **All Docs** | `setup/docs/` — 25+ HTML files covering every core system in detail |

## Quick Commands

| Command | What it does |
|---|---|
| `npm run dashboard` | Launch setup dashboard (browser UI for all configuration) |
| `npm run kill-dashboard` | Kill dashboard process if port 3456 is stuck |
| `npm run dev` | Start local dev server (production URL) |
| `npm run dev:staging` | Start local dev server (staging URL — shows red STAGING indicator in header) |
| `eas build --platform ios --profile production` | Build iOS via EAS |
| `eas build --platform android --profile production` | Build Android via EAS |
| `eas submit --platform ios --latest` | Submit latest iOS build to App Store Connect |
| `eas update --channel production --message "..."` | Push OTA update to production users (JS-layer only) |

## Core Files — Do Not Edit

The following directories and files are **core** and will be **overwritten when you apply updates**:

- `app/` — Screen routes and navigation
- `components/` — Shared UI components
- `services/` — API clients, auth, push notifications
- `contexts/` — React context providers
- `hooks/` — Custom React hooks
- `utils/` — Utility functions
- `types/` — TypeScript type definitions
- `constants/colors.ts` — Theme color definitions (overridden by Fluent sync)

**Safe to edit** (protected during updates):
- `constants/config.ts` — Your app name, site URL
- `app.json` — Bundle IDs, EAS config, permissions
- `eas.json` — Build profiles, submit config
- `app.config.ts` — Fallback values
- `assets/images/` — Your branding assets
- `modules/` — Your custom modules

> **Source of truth:** `manifest.json` → `protectedPaths` defines exactly which files are preserved during updates. Everything else is core and gets overwritten.

> **Warning:** If you modify core files, your changes will be lost when applying a core update. If you need custom behavior, build it as a module instead.

## Companion Plugins

The `companion plugins/` folder contains WordPress plugins. Install these on your WordPress site.

**Core (required):** tbc-community-app (REST endpoints).

**Add-ons (sold separately):** Paired module + plugin packages — the app module lives in `modules/`, the companion plugin lives in `companion plugins/`. Both are required for the feature to work.

See `docs/companion-plugins.html` for full plugin reference including endpoints and installation.

> When working on companion plugins, always update the version number and changelog after changes.

## Module System

Self-contained features that plug into the app without touching core code. Full reference: `docs/module-system.html`

- **Define** a manifest in `modules/yourmodule/module.ts`
- **Register** in `modules/_registry.ts` (one line to enable/disable)
- **Route stub** in `app/(tabs)/` (one-line re-export, only if module has a tab)
- **Companion plugin** in `companion plugins/` (if module needs a WordPress backend)

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

Use the version bump buttons in the setup dashboard (`npm run dashboard`). If bumping manually, update: `package.json` → version, `app.json` → expo.version + ios.buildNumber + android.versionCode.

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
- **Logging**: Use `createLogger(tag)` from `@/utils/logger` — never raw `console.log`. See `docs/logging.html`.
- **`__DEV__` checks**: Used for dev-only validation. Never wrap user-facing logic in `__DEV__`.

## General Rules

- Do not create new dependencies or utilities without checking the project first — there may already be centralized functions for what you need.
- Don't guess or make up APIs — always check existing endpoints and services first.

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
| `npm run changelog` | Generate/update CHANGELOG.md from git history since last version bump |

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

### Versioning — Core vs App

There are two separate version numbers:

- **Core version** (`manifest.json` → `version`) — The version of the white-label product/engine. Only we (the devs) control this. Buyers never touch it — it gets overwritten when they apply an update zip. Displayed in the dashboard header badge so buyers can confirm their update applied correctly.
- **App version** (`app.json` + `package.json`) — The buyer's App Store version. They bump this themselves via the dashboard when submitting to stores.

When we bump the app version for a release, also bump `manifest.json` → `version` to match so the core version stays in sync.

### White-Label Snapshot

After a version bump, ask the user if we should create a new white-label snapshot.

The snapshot script copies this app to the white-label folder with all site-specific values replaced by generic placeholders. It does NOT modify this repo — only writes to the target folder.

**To run:** `npm run snapshot`

**What it does:**
1. Copies project to `../TBC-Community-App (White Lable)/` (excludes node_modules, .git, modules, companion plugins)
2. Copies only core companion plugins (allowlist: tbc-community-app)
3. Copies only module infrastructure (`_registry.ts`, `_types.ts`) — no module folders
4. Replaces Two Birds-specific values with placeholders in config.ts, app.json, eas.json, app.config.ts, package.json
5. Removes Firebase configs, adds FIREBASE_SETUP.md guide
6. Strips site-specific section from CLAUDE.md
7. Verifies no site-specific references remain

**What ships in the base white-label product:**
- Core app (all screens, services, components)
- Core companion plugin: tbc-community-app

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
