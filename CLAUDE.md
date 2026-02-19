This is a companion for our social media site running off Fluent community and WordPress. This app is designed to be intuitive lightweight modern in all aspects NO BLOAT fully compatible with IOS and ANDROID devices.

do not create new depndacies or utilites without asking. check entire project first we may already have these thigns centrailsed functions ect. dont recreate things duplciate code. 

we DONT want to break things! 

## Companion Plugins & Themes

The `companion plugins/` folder contains WordPress plugins and themes that work with this app. Always reference when needed.

### Native Fluent Plugins (official, by the Fluent team — we built our app around these)
- **fluent-community** — Core Fluent Community plugin
- **fluent-community-pro** — Pro add-on
- **fluent-messaging** — Messaging add-on

### Our Custom Plugins (all custom APIs exposed through tbc-community-app)
- **tbc-community-app** — Main bridge plugin connecting our app to WordPress. All custom REST endpoints live here.
- **tbc-fluent-profiles** — Custom profile fields for Fluent Community
- **tbc-multi-reactions** — Multi-reaction support for Fluent Community
- **tbc-otp-verification** — OTP verification for registration (Twilio)

### Our Custom Theme
- **fluent-starter** — Custom WordPress theme

Current TEST credtials for when YOU give me commands curl -s -u "tas:WZm0 KKI7 g0H0 2CYd rJkx 6Ra1"

dont try running commands your self jsut give them to me and wait for response. if unsure always ask for a API response to understand full pciture

Server runs Ubuntu - use python3 not python for curl JSON formatting (e.g. `| python3 -m json.tool`)

all agents run opus

---

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
| `deep_bg` | `deepBg` | Deep accent background |
| `highlight_bg` | `highlightBg` | Highlight/attention bg |
| `primary_text` | `text` | Main body text |
| `secondary_text` | `textSecondary` | Meta/subtitle text |
| `text_off` | `textTertiary` | Disabled/hint text |
| `menu_text` | `icon` | Icon/menu text color |
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
- `primaryLight` — Lighter brand variant
- `accent` — Accent color (amber)
- `iconActive` — Active icon color
- **Semantic:** `success`, `successLight`, `error`, `errorLight`, `warning`, `warningLight`, `info`, `infoLight`
- **Reactions:** `reactions.like/love/laugh/wow/sad/angry`
- **Special:** `verified`, `online`, `skeleton`, `skeletonHighlight`, `overlay`

### Usage Rules
- **Always** use `const { colors } = useTheme()` — never import `lightColors`/`darkColors` directly in components
- Use `colors.textInverse` for text on colored buttons — NOT `#fff`
- Use `colors.error` / `colors.errorLight` for error states — NOT `#EF4444` / `#FEE2E2`
- Use `colors.success` / `colors.successLight` for success states
- Use `colors.overlay` for modal/sheet backdrops — NOT `rgba(0,0,0,0.5)`
- Use `withOpacity(color, opacity)` from `@/constants/colors` for transparent variants of theme colors
- `shadowColor: '#000'` is fine (iOS standard)
- Calendar status gradients, YouTube brand red, video player black backgrounds are intentionally static

When working on companion plugins after updates fixes changes make sure you update the version number on the plugin or theme and update changelog. If change log missing add one.