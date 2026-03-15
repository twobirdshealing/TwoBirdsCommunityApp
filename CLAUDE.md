Two Birds Church Community App — React Native (Expo), iOS + Android, built on WordPress + Fluent Community.

Site: https://community.twobirdschurch.com
Dev brand: Two Birds Code (twobirdscode.com) — TBC

## Dev Workflow

**This repo is both our live production app AND the development source for the white-label product.** All coding happens here. When we hit a milestone, we run `bash scripts/create-white-label.sh` to generate a clean snapshot at `../TBC-Community-App (White Lable)/` with site-specific values replaced by placeholders. Never edit the white-label folder directly — it gets overwritten each snapshot.

**Architecture goal:** Keep core clean, fast, and stable — only update it for Fluent Community compatibility. New features go in as modules so they don't interfere with core code.

> **Buyer-facing setup documentation lives in `docs/setup-guide.html`.**
> When making changes to config files, module system, or plugin structure, keep docs in sync.

## White-Label Setup

Files a buyer edits to make the app theirs:

| What | File(s) | Notes |
|---|---|---|
| App name, site URL, Pusher keys, feature flags | `constants/config.ts` | All buyer-editable values marked `// SETUP` |
| Active modules | `modules/_registry.ts` | Comment out to disable a module |
| Bundle IDs, app name, icons, scheme | `app.json` | iOS bundle ID, Android package name, icon paths |
| EAS owner + project ID | `app.json` | `expo.owner`, `expo.extra.eas.projectId` — required for builds & push |
| Permission dialog strings | `app.json` | Replace app name in camera/photos/media permission text |
| Notification & icon colors | `app.json` | `expo-notifications` color, `adaptiveIcon.backgroundColor` |
| Build profiles + submit config | `eas.json` | `SITE_URL` per profile, Apple ID + ascAppId for iOS submissions |
| Fallback values | `app.config.ts` | SITE_URL fallback, name/slug fallbacks for local dev |
| Branding assets | `assets/images/` | App icon, splash screen, login background/logo |
| Default colors | `constants/colors.ts` | Fallback colors (overridden by Fluent Community theme sync) |
| Firebase (Android) | `google-services.json` | Replace with your Firebase project config |
| Firebase (iOS) | `GoogleService-Info.plist` | Replace with your Firebase project config |
| Package name | `package.json` | `"name"` field (not user-visible, for repo cleanliness) |

## Module System

Self-contained features that plug into the app without touching core code. Each module registers any combination of: bottom tabs, home widgets, menu items, header icons, context providers, tab bar addons.

- **Define** a manifest in `modules/yourmodule/module.ts`
- **Register** in `modules/_registry.ts` (one line to enable/disable)
- **Route stub** in `app/(tabs)/` (one-line re-export, only if module has a tab)

Core features (feed, spaces, profiles, messaging, courses, blog, YouTube, cart) stay in core with `FEATURES.*` flags in `constants/config.ts`. Modules are for self-contained add-ons with their own companion WordPress plugins.

## ADDon Modules
We have 
Blog module - this is not part of core it is avlaible as an addon. not part of the snap shot

bookclub module - this is not part of core it is avlaible as an addon. not part of the snap shot

youtube module - this is not part of core it is avlaible as an addon. not part of the snap shot

Caledndar module - this is not part of core. This is custom to our site two birds church only specific to our needs not an addon that is public.

donate module - this is not part of core. This is custom to our site two birds church only specific to our needs not an addon that is public.

donor module - this is not part of core. This is custom to our site two birds church only specific to our needs not an addon that is public.

Full documentation: `docs/setup-guide.html` (Module System section)

## Import Rules — Direct Imports Only

**No barrel files (`index.ts` re-exports).** Always import directly from the source file. Metro bundler doesn't tree-shake — barrel imports force it to load every sibling module even when you only need one. They also cause circular dependency issues and slow cold start on mobile.

- `import { Avatar } from '@/components/common/Avatar'` — correct
- `import { Avatar } from '@/components/common'` — WRONG (barrel import)

Do NOT create `index.ts` barrel/re-export files in any directory.

## Theme System — Fluent Community Color Sync

Full reference: `docs/theme-system.html` (token maps, Fluent CSS variables, usage rules, PHP endpoint)

Quick rules:
- **Always** use `const { colors } = useTheme()` — never import `lightColors`/`darkColors` directly
- Use `colors.textInverse` for text on colored buttons — NOT `#fff`
- Use semantic tokens (`colors.error`, `colors.success`) — NOT hex literals
- Use `colors.overlay` for modal/sheet backdrops — NOT `rgba(0,0,0,0.5)`
- Use `withOpacity(color, opacity)` from `@/constants/colors` for transparent variants
- `shadowColor: '#000'` is fine (iOS standard)
- Calendar status gradients, YouTube brand red, video player black backgrounds are intentionally static

## Companion Plugins & Themes

The `companion plugins/` folder contains WordPress plugins and themes that ship with or extend this app. `Refrence plugins ONLY/` subfolder holds third-party plugins for dev reference (gitignored).

### Core & Module Plugins (in `companion plugins/`)
- **tbc-community-app** — Main bridge plugin connecting the app to WordPress. All custom REST endpoints live here.
- **tbc-fluent-profiles** — Custom profile fields, OTP verification (Twilio), and registration for Fluent Community
- **tbc-multi-reactions** — Multi-reaction support for Fluent Community
- **tbc-youtube** — YouTube channel integration with server-side caching (companion to youtube module)
- **tbc-book-club** — Book club audiobook player with meetings (companion to bookclub module)
- **tbc-calendar-fluent** - our private claendar plugin that links to our claendar module


### Our Custom Theme
- **tbc-starter-theme** — Custom WordPress theme

### Site-Specific Plugins (not in repo — on server only)
donation addons, donor dashboard, messaging center, checkout prerequisites, participant frontend, space manager, bulk tools, entry review — these are Two Birds Church site-specific and not part of the product we ocaisoly bring them into the compaion folder for refernce.

## App Version Bumping

After completing a task, ask the user if we should bump the app version. If yes, update all 4 places:

1. `package.json` → `version`
2. `app.json` → `expo.version`
3. `app.json` → `ios.buildNumber` (string, matches version e.g. `"3.0.1"`)
4. `app.json` → `android.versionCode` (integer, pattern: `major*100 + minor*10 + patch` e.g. `301`)

EAS is set to `appVersionSource: "local"` — all versioning comes from these files, not remote.

## White-Label Snapshot

After a version bump, ask the user if we should create a new white-label snapshot.

The snapshot script copies this app to the white-label folder with all site-specific values replaced by generic placeholders. It does NOT modify this repo — only writes to the target folder.

**To run:** `bash scripts/create-white-label.sh`

**What it does:**
1. Copies project to `../TBC-Community-App (White Lable)/` (excludes node_modules, .git, modules, companion plugins)
2. Copies only core companion plugins (allowlist: tbc-community-app, tbc-fluent-profiles, tbc-multi-reactions, tbc-starter-theme)
3. Copies only module infrastructure (`_registry.ts`, `_types.ts`) — no module folders
4. Replaces Two Birds-specific values with placeholders in config.ts, app.json, eas.json, app.config.ts, package.json
5. Removes Firebase configs, adds FIREBASE_SETUP.md guide
6. Removes CLAUDE.md and scripts/ from the output
7. Verifies no site-specific references remain

**What ships in the base white-label product:**
- Core app (all screens, services, components)
- Core companion plugins: tbc-community-app, tbc-fluent-profiles, tbc-multi-reactions, tbc-starter-theme

**Sold separately as add-ons (NOT in white-label):**
- Blog module, YouTube module + tbc-youtube plugin, Book Club module + tbc-book-club plugin

**Two Birds site-specific (never sold):**
- Calendar, Donate, Donor modules

---

## Development & Debugging

- **Dev client**: App uses `expo-dev-client` (NOT Expo Go). After adding native modules, a new dev client build is needed via EAS.
- **Logging**: Use `createLogger(tag)` from `@/utils/logger` for all debug logging. It only outputs in `__DEV__` mode, zero-cost in production. Don't use raw `console.log` — always use tagged loggers.
  ```ts
  const log = createLogger('Pusher');
  log('connected');        // [Pusher] connected
  log.warn('reconnecting'); // [Pusher] reconnecting
  log.error('failed', err); // [Pusher] failed <error>
  ```
- **`__DEV__` checks**: Used throughout for dev-only validation (module registry, duplicate detection). Never wrap user-facing logic in `__DEV__`.
- **Common commands**:
  - `npx expo start --dev-client --clear` — start local dev server (clears Metro cache)
  - `eas build --platform ios --profile production` — build via EAS
  - `eas build --platform android --profile production` — build via EAS
  - `eas submit --platform ios --latest` — submit latest iOS build to App Store Connect
  - Android: download the `.aab` from EAS manually, upload to Google Play Console

## Dev Rules

Do not create new dependencies or utilities without asking. Check entire project first — we may already have centralised functions. Don't recreate things or duplicate code.

We DONT want to break things! Don't guess or make up APIs — always check first.

After fixes or completed tasks ask user if we want to run /simplify

When working on companion plugins after updates/fixes/changes, update the version number on the plugin or theme and update changelog. If changelog is missing add one. Always update version to bust cache even on small updates.

## Testing

Current test credentials — ask for fresh token:
```
curl -s -X POST "https://community.twobirdschurch.com/wp-json/tbc-ca/v1/auth/login" -H "Content-Type: application/json" -d '{"username":"bluejay","password":"sapo"}' | python3 -m json.tool
```

Don't try running commands yourself — give them to me and wait for response. If unsure, always ask for an API response to understand the full picture.

Server runs Ubuntu — use `python3` not `python` for curl JSON formatting (e.g. `| python3 -m json.tool`)

All agents run opus
