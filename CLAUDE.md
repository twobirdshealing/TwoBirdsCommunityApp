Two Birds Community App — our live production community app built on WordPress + Fluent Community.
React Native (Expo), iOS + Android. This is the Two Birds Church app instance.

Site: https://community.twobirdschurch.com
Dev brand: Two Birds Code (twobirdscode.com) — TBC

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
| Build profiles | `eas.json` | `SITE_URL` env var per profile (dev, preview, production) |
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

Full documentation: `docs/setup-guide.html` (Module System section)

## Import Rules — Direct Imports Only

**No barrel files (`index.ts` re-exports).** Always import directly from the source file. Metro bundler doesn't tree-shake — barrel imports force it to load every sibling module even when you only need one. They also cause circular dependency issues and slow cold start on mobile.

- `import { Avatar } from '@/components/common/Avatar'` — correct
- `import { Avatar } from '@/components/common'` — WRONG (barrel import)

Do NOT create `index.ts` barrel/re-export files in any directory.

## Theme System — Fluent Community Color Sync

The app's colors are synced from Fluent Community's color schemas (light + dark mode). Colors flow:

`Fluent Community (Utility.php)` → `tbc-community-app REST API (/tbc-ca/v1/theme/colors)` → `services/api/theme.ts` → `ThemeContext` → `useTheme().colors`

### Key Files
- `constants/colors.ts` — `ColorTheme` interface, light/dark defaults, `mapFluentToAppColors()`, `withOpacity()`
- `contexts/ThemeContext.tsx` — Provider, caches colors in SecureStore, background-refreshes from API
- `services/api/theme.ts` — Fetches `/tbc-ca/v1/theme/colors` (public, no auth)
- `companion plugins/tbc-community-app/includes/theme/class-theme-colors.php` — REST endpoint

### Fluent → App Token Map (server-driven, auto-synced)

**Body tokens (content area):**

| Fluent Key | App Token | Purpose |
|---|---|---|
| `primary_bg` | `surface` | Card/content background |
| `secondary_bg` | `background` | Page background |
| `secondary_content_bg` | `backgroundSecondary` | Comment/secondary areas |
| `active_bg` | `activeBg` | Active/selected item bg |
| `light_bg` | `lightBg` | Light accent background |
| `deep_bg` | `deepBg` | Code block / preformatted text bg |
| `highlight_bg` | `highlightBg` | Notice/alert bg, highlighted comments |
| `primary_text` | `text` | Main body text |
| `secondary_text` | `textSecondary` | Meta/subtitle text |
| `text_off` | `textTertiary` | Disabled/hint text |
| `text_link` | `primary` | Links & brand accent |
| `primary_button` | `primaryDark` | Button background |
| `primary_button_text` | `textInverse` | Button text (inverse) |
| `primary_border` | `border` | Main borders |
| `secondary_border` | `borderLight` | Light/subtle borders |

**Header tokens → Tab Bar:**

| Fluent Key | App Token |
|---|---|
| `primary_bg` | `tabBar.background` |
| `primary_border` | `tabBar.border` |
| `menu_text_active` | `tabBar.active` |
| `menu_text` | `tabBar.inactive` |

**Sidebar tokens** — received but not used (mobile has no sidebar).

### App-Only Tokens (local defaults, not from Fluent)
- **Semantic:** `success`, `successLight`, `error`, `errorLight`, `warning`, `warningLight`, `info`, `infoLight`
- **Special:** `overlay`
- Use `withOpacity(color, opacity)` for lighter brand tints — e.g. `withOpacity(colors.primary, 0.12)` for pills/badges
- `info` doubles as verified badge color, `success` doubles as online indicator color, `border` doubles as skeleton/placeholder bg

### Usage Rules
- **Always** use `const { colors } = useTheme()` — never import `lightColors`/`darkColors` directly in components
- Use `colors.textInverse` for text on colored buttons — NOT `#fff`
- Use `colors.error` / `colors.errorLight` for error states — NOT `#EF4444` / `#FEE2E2`
- Use `colors.success` / `colors.successLight` for success states
- Use `colors.overlay` for modal/sheet backdrops — NOT `rgba(0,0,0,0.5)`
- Use `withOpacity(color, opacity)` from `@/constants/colors` for transparent variants of theme colors
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

### Our Custom Theme
- **tbc-starter-theme** — Custom WordPress theme

### Site-Specific Plugins (not in repo — on server only)
Calendar, donation addons, donor dashboard, messaging center, checkout prerequisites, participant frontend, space manager, bulk tools, entry review — these are Two Birds Church site-specific and not part of the product.

## App Version Bumping

After completing a task, ask the user if we should bump the app version. If yes, update all 4 places:

1. `package.json` → `version`
2. `app.json` → `expo.version`
3. `app.json` → `ios.buildNumber` (string, matches version e.g. `"3.0.1"`)
4. `app.json` → `android.versionCode` (integer, pattern: `major*100 + minor*10 + patch` e.g. `301`)

EAS is set to `appVersionSource: "local"` — all versioning comes from these files, not remote.

---

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
