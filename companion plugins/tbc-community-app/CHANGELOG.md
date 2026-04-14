# Changelog

## 1.0.1 — 2026-04-14

Version bump in lockstep with `tbc-profile-completion` 1.0.1 — they shipped together as a single refactor (profile-completion REST endpoints extracted out of core into the add-on plugin under its own `tbc-pcom/v1` namespace) and any site upgrading one should upgrade the other in the same step. No code changes in this release.

## 1.0.0 — 2026-04-14

Initial release.

The core companion plugin for the TBC Community App. Provides the WordPress-side REST surface, mobile auth, registration, push notifications, deep linking, web sessions, and crash-reporting configuration that the React Native app talks to. Required by all add-on companion plugins.

### REST API
- Auth endpoints: register, login, logout, password forgot/reset — all rate-limited via FluentCommunity's `AuthHelper::isAuthRateLimit()` (with a per-IP transient fallback if FC isn't loaded)
- Registration API with FC custom-field support, avatar upload sync, and a `/registration/status` endpoint that returns existing profile data (using FC's native `XProfile::hasCustomAvatar()` so the mobile form never pre-fills FC's auto-generated Gravatar/ui-avatars fallback as a "real" avatar)
- App config endpoint (`/app-config`) exposing site features, branding, social providers, crash reporting DSN, and capability flags from companion plugins via `tbc_ca_registration_config` filter
- WP REST field embeds: `fcom_avatar`, `fcom_is_verified`, `fcom_badge_slugs` on user objects, plus `fcom_author_*` equivalents on comments — lets the mobile feed render avatars + verified status without a second profile fetch
- One-time WebView session tokens for in-app web views, tracked in user meta and revoked on logout (prevents redemption of in-flight tokens after sign-out)

### Mobile integration
- Push notification routing
- Deep link handling with custom URL scheme support
- App-specific styling injected into the WP admin where needed
- Crash Reporting settings tab: buyers paste their Sentry DSN and toggle on/off without rebuilding the app — the mobile app reads `crash_reporting: { enabled, dsn }` from `/app-config` on startup and only initializes Sentry when both are valid (zero data sent when disabled)

### Auto-detected features
- Site Features section automatically detects which FC modules are active (dark mode, messaging, courses, followers, giphy, emoji, badges, custom fields) instead of relying on stale manual toggles

### Hardening
- All `SHOW TABLES LIKE` existence checks go through `$wpdb->prepare()` with `$wpdb->esc_like()` so static security scanners stay quiet and future edits don't introduce real injection vectors
