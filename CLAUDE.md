Community App — React Native (Expo), iOS + Android, built on WordPress + Fluent Community.

## About This Project

This is a white-label community app powered by [Fluent Community](https://fluentcommunity.co). It connects to your WordPress site and provides a native mobile experience for your community — feed, messaging, profiles, spaces, courses, and more.

## Documentation

| Resource | Location |
|---|---|
| **Setup Guide** | `setup/setup-guide.html` — Full walkthrough with screenshots |
| **Setup Dashboard** | `npm run dashboard` — Browser-based config UI at localhost:3456 |
| **Theme System** | `docs/theme-system.html` — Color tokens, Fluent CSS sync, usage rules |
| **Module System** | `setup/setup-guide.html` (Module System section) |

## Quick Commands

| Command | What it does |
|---|---|
| `npm run dashboard` | Launch setup dashboard (browser UI for all configuration) |
| `npx expo start --dev-client --clear` | Start local dev server (clears Metro cache) |
| `eas build --platform ios --profile production` | Build iOS via EAS |
| `eas build --platform android --profile production` | Build Android via EAS |
| `eas submit --platform ios --latest` | Submit latest iOS build to App Store Connect |

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
- `constants/config.ts` — Your app name, feature flags, site URL
- `app.json` — Bundle IDs, EAS config, permissions
- `eas.json` — Build profiles, submit config
- `app.config.ts` — Fallback values
- `assets/images/` — Your branding assets
- `modules/` — Your custom modules

> **Warning:** If you modify core files, your changes will be lost when applying a core update. If you need custom behavior, build it as a module instead.

## Companion Plugins

The `companion plugins/` folder contains WordPress plugins and a theme that ship with the app. Install these on your WordPress site.

### Core Plugins (required)
- **tbc-community-app** — Main bridge plugin. All custom REST endpoints that the app uses to communicate with WordPress.
- **tbc-fluent-profiles** — Custom profile fields, OTP phone verification (Twilio), and registration flow for Fluent Community.
- **tbc-multi-reactions** — Multi-reaction support (like, love, laugh, etc.) for Fluent Community posts.

### Theme
- **tbc-starter-theme** — WordPress theme that provides the app's web companion views and color sync endpoint.

### Add-on Plugins (sold separately)
Add-on modules may include their own companion plugin. Install the plugin on your WordPress site when you activate the module.

## Module System

Self-contained features that plug into the app without touching core code. Each module registers any combination of: bottom tabs, home widgets, menu items, header icons, context providers, tab bar addons.

- **Define** a manifest in `modules/yourmodule/module.ts`
- **Register** in `modules/_registry.ts` (one line to enable/disable)
- **Route stub** in `app/(tabs)/` (one-line re-export, only if module has a tab)

Core features (feed, spaces, profiles, messaging, courses) are controlled by `FEATURES.*` flags in `constants/config.ts`. Modules are for self-contained add-ons that go beyond core.

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

## Your Instructions

Add your own project-specific notes, preferences, and instructions below. This section is yours — it won't be affected by core updates.

<!-- YOUR_CUSTOM_INSTRUCTIONS_START -->

<!-- YOUR_CUSTOM_INSTRUCTIONS_END -->

<!-- ====================================================================== -->
<!-- SITE-SPECIFIC — Everything below this line is stripped from snapshots  -->
<!-- SNAPSHOT_STRIP_BELOW -->

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
2. Copies only core companion plugins (allowlist: tbc-community-app, tbc-fluent-profiles, tbc-multi-reactions, tbc-starter-theme)
3. Copies only module infrastructure (`_registry.ts`, `_types.ts`) — no module folders
4. Replaces Two Birds-specific values with placeholders in config.ts, app.json, eas.json, app.config.ts, package.json
5. Removes Firebase configs, adds FIREBASE_SETUP.md guide
6. Strips site-specific section from CLAUDE.md
7. Verifies no site-specific references remain

**What ships in the base white-label product:**
- Core app (all screens, services, components)
- Core companion plugins: tbc-community-app, tbc-fluent-profiles, tbc-multi-reactions, tbc-starter-theme

**Sold separately as add-ons (NOT in white-label):**
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
