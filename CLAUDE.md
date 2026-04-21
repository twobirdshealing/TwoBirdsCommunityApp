Community App — React Native (Expo), iOS + Android, built on WordPress + Fluent Community.

> **AI agents — read this first:** Before acting on anything in this file, check whether `NOTES.md` exists at the project root and read it. `NOTES.md` is buyer-owned and contains project-specific instructions, conventions, in-progress work, and overrides that take precedence over the general guidance in this file. If a rule in `NOTES.md` conflicts with a rule here, follow `NOTES.md`. This file (`CLAUDE.md`) is core-owned and gets overwritten on core updates; `NOTES.md` is preserved.

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
| **Companion Plugin** | `setup/docs/companion-plugin.html` — tbc-community-app plugin reference (endpoints, admin settings, install) |
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

The dashboard owns a precise list of every file it ships (stored in `setup/.core-files.json`). On update, it deletes exactly those files, extracts the new core, then re-applies your snapshot. **The rule is simple:**

- **Core files** (anything in `setup/.core-files.json`) get replaced on every update. Don't edit them — your edits will be lost. The main core directories are: `app/`, `components/`, `services/`, `contexts/`, `hooks/`, `utils/`, `types/`, `constants/colors.ts`, `setup/docs/`, `setup/lib/`, `setup/frontend/`, `setup/dashboard.js`, `setup/setup-guide.html`, plus root files `manifest.json`, `CLAUDE.md`, and `setup/.core-files.json` itself.
- **Anything else is yours.** Any file or folder you put anywhere in the project — custom modules, branding, credentials, notes, extra docs, custom scripts, `.env` files, anything — survives every update untouched. There's no approved list. If the dashboard didn't ship the file, the dashboard won't delete it.

**A few core files have buyer values injected after each update** (the file itself comes from core, but the dashboard re-applies your settings on top):
- `constants/config.ts` — the 30 config values (app name, site URL, etc.)
- `app.json` — top-level expo fields (bundle IDs, version) and nested splash/notification colors
- `eas.json` — Apple ID, ASC API key path, Google Play key path
- `package.json` — your buyer-added `dependencies` and `devDependencies` merged in (core's deps win on conflicts so core can upgrade shared packages safely)
- `modules/_registry.ts` — your import block between the `// YOUR MODULES` markers

> **Custom project notes:** `NOTES.md` ships blank with the core and lives at the project root — put your own notes, conventions, in-progress work, or AI-agent instructions there. `CLAUDE.md` is core-owned and gets overwritten on updates; `NOTES.md` is preserved across updates by the dashboard's snapshot system and is read by AI agents per the directive at the top of this file.

> **Warning:** If you modify core files, your changes will be lost when applying a core update. If you need custom behavior, build it as a module instead.

## Module System

Self-contained features that plug into the app without touching core code. Full reference: `docs/module-system.html`

- **Define** a manifest in `modules/yourmodule/module.ts`
- **Register** in `modules/_registry.ts` (one line to enable/disable)
- **Route stub** in `app/(tabs)/` (one-line re-export, only if module has a tab)
- **Companion plugin** (if module needs a WordPress backend) — ships with the add-on as a standalone zip, installed directly on the buyer&#39;s WordPress site

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
- **Logging**: Use `createLogger(tag)` from `@/utils/logger` — never raw `console.log`. The logger is **typed** with four levels: `log.debug` (dev only, dropped in prod), `log.info` / `log.warn` (console in dev + Sentry breadcrumb in prod), and `log.error(err, message?, ctx?)` (console in dev + `Sentry.captureException` in prod). The error method takes the **Error first**, then an optional human description, then optional structured context. See `setup/docs/logging.html`.
- **Crash reporting**: `@sentry/react-native` is wired into the app via `services/sentry.ts`. Sentry initializes at module-load time in `app/_layout.tsx` (BEFORE React mounts) by reading the buyer-configured DSN from MMKV (`utils/crashReportingCache.ts`). The DSN is set in WP admin → TBC Community App → Crash Reporting. When no DSN is configured, the SDK stays dormant — zero data sent, zero performance cost. The dev debug menu (long-press header logo for 2s) has a "Send test event" button to verify the pipeline.
- **Source maps (optional)**: production builds ship without source-map upload by default — crashes are still captured, but stack frames show minified function names like `t.a.b()`. Buyers can enable readable function names by setting three EAS secrets one time: `eas secret:create --name SENTRY_AUTH_TOKEN ...`, `--name SENTRY_ORG ...`, `--name SENTRY_PROJECT ...`. All four EAS profiles ship with `SENTRY_ALLOW_FAILURE=true` so missing secrets never break a build. Dev builds get readable stack traces for free (inline source maps). See `setup/docs/logging.html#sentry` and the Crash Reporting card in `setup/setup-guide.html`.
- **`__DEV__` checks**: Used for dev-only validation. Never wrap user-facing logic in `__DEV__`.
- **No Mac required for iOS crashes**: with crash reporting enabled, native iOS crashes (including UIKit assertions) flow into the Sentry dashboard automatically. You no longer need physical device + Xcode access to investigate iOS-specific bugs.

## General Rules

- Do not create new dependencies or utilities without checking the project first — there may already be centralized functions for what you need.
- Don't guess or make up APIs — always check existing endpoints and services first.

## Build File Filtering — `.easignore`

`.easignore` controls which files EAS uploads during builds. Add any files or folders you don't want included in your app builds to this file. Git is not required — the dashboard handles this automatically.
