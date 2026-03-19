# Changelog

All notable changes to the TBC Community App plugin.

## v3.44.7
- **Fix registration field types for app**: FC's FormBuilder downgrades field types it can't render (e.g. `date` → `text`), and the API was returning those mangled types. Now cross-references FC's real field definitions to restore correct types (birthdate shows native date picker instead of text input). Also maps `_phone` to `phone` type so the app shows a phone keypad.

## v3.44.6
- **Fix web registration missing custom fields**: FC's native web signup form collected custom profile fields (pronouns, phone, SMS opt-in, etc.) but never saved them to `xprofile.custom_fields`. Added `user_register` hook that captures custom field values from `$_POST` during FC's web registration AJAX and persists them — same pattern as the app registration flow. Ensures XProfile row exists first via `syncXProfile()` since the hook fires before FC creates it.

## v3.44.5
- **Fix field types on web signup form**: FC's FormBuilder strips non-whitelisted input types, so date/number/phone fields rendered as plain text inputs. Added JS injection via `wp_footer` that converts fields back to their correct HTML5 types (`date`, `number`, `tel`) so browsers show native pickers (e.g. Birthdate gets a date picker, Phone gets a tel keypad on mobile). Fixed slug matching to use FC's `_` prefix (e.g. `_phone` not `phone`). Scoped script to only run on FC auth pages.

## v3.44.3
- **Time format in app-config**: Added `time_format` field to `/app-config` response — returns the WordPress general time format setting (e.g., `g:i a` for 12h, `H:i` for 24h). Syncs with Fluent Messaging 2.3.0's time format awareness.

## v3.44.2
- **Removed dead OTP code from password recovery** — `handle_forgot()` no longer checks for `TBCRegistration\Helpers` or attempts OTP via Twilio. Password reset is WordPress native email only, matching the app's email-only UI.

## v3.43.0
- **Base registration endpoints**: Added `tbc-ca/v1/auth/register/fields`, `tbc-ca/v1/auth/register`, `tbc-ca/v1/auth/register/status`, `tbc-ca/v1/auth/register/complete` — registration now works with FC's native registration without requiring tbc-registration plugin
- **Registration capabilities in /app-config**: New `registration` object in app-config response with `enabled`, `email_verification`, `otp`, and `profile_completion` fields. Add-on plugins (tbc-otp, tbc-profile-completion) hook `tbc_ca_registration_config` filter to advertise their capabilities
- **Plugin hook points**: `tbc_ca_pre_register` filter (before user creation), `tbc_ca_post_register` action (after user creation), `tbc_ca_profile_status` and `tbc_ca_complete_registration` filters for add-on extensibility

## v3.42.0
- **Plugin rename alignment**: Updated `tbc_fp_registration_response` filter → `tbc_reg_registration_response` to match tbc-registration plugin rename. Also updated `TBC_FP_META_REGISTRATION_COMPLETE` → `TBC_REG_META_REGISTRATION_COMPLETE` constant reference and `tbc_fp_recovery_` → `tbc_reg_recovery_` session prefix.

## v3.41.0
- **REST API index hidden**: Unauthenticated requests to `/wp-json/` now return 403 — prevents bots from discovering custom endpoints via the REST API index. All specific endpoints still work normally for both authenticated and unauthenticated requests.

## v3.40.0
- **Server-driven socket config**: New `socket` section in `/app-config` response returns Pusher/Fluent Socket/Soketi connection config from Fluent Messaging settings. Mobile app auto-detects the socket provider — buyers configure once in WordPress admin, no app-side config needed. Mirrors the approach used by Fluent Messaging's web frontend (`ChatAppHandler`). Returns `null` when Fluent Messaging is not active.

## v3.39.0
- Removed deprecated registration API (`tbc-ca/v1/register/*`) and OTP API (`tbc-ca/v1/otp/*`) — all registration and OTP now handled by tbc-registration (`tbc-reg/v1`)
- Removed autoloader entries and class file loading for `class-registration-api.php` and `class-otp-api.php`

## v3.38.0
- Added "Delete all plugin data when uninstalled" setting in General tab — uninstall preserves all data by default to prevent accidental data loss during troubleshooting or reinstalls
- Added `uninstall.php` — when opted in, removes settings, device tokens, push logs, JWT secrets, session meta, and database tables

## v3.37.0
- **YouTube API extracted**: Moved `TBC_CA_YouTube_API` to standalone tbc-youtube plugin (`tbc-yt/v1` namespace). Old `tbc-ca/v1/youtube` endpoints now served by tbc-youtube with backward compatibility. YouTube settings removed from General tab — configure via YouTube submenu page.

## v3.36.0
- **Branding in app-config**: New `branding` section in `/app-config` response returns `site_name`, `site_tagline`, `logo`, and `logo_dark` from Fluent Community general settings (falls back to WordPress `blogname` / `blogdescription`). Enables white-label apps to sync branding from the server instead of hardcoding.

## v3.35.0
- **UI Visibility: pass all keys to app**: Removed whitelist filter in `get_visibility_flags()` — all hidden element keys (including `donate`, `donor_dashboard`, and custom keys) now flow through `hide_menu[]` to the app. Previously only 5 core keys were returned.
- **Custom visibility elements**: Admins can add custom key/label pairs in Settings → UI Visibility. These appear as columns in the role-based visibility grid. Use this when adding app modules with `hideMenuKey` — no PHP code changes needed.

## v3.34.0
- **Book Club API removed**: Moved `TBC_CA_Book_Club_API` to tbc-book-club plugin (`tbc-bc/v1` namespace). Old `tbc-ca/v1/books` endpoints no longer registered.

## v3.33.0
- **User Visible column in admin**: New "User Visible" checkbox per notification type in Settings → Notifications. Controls whether the type appears in the app's user notification settings. Unchecked types still fire notifications but users can't toggle them off.
- `new_direct_message` and `manual_notification` default to hidden (unchecked). Admin can override any type's visibility without code changes.
- Admin settings override takes priority over code defaults for `user_configurable`.

## v3.32.0
- **Server-driven notification settings**: Push type registry now includes UI metadata (`email_key`, `group`, `group_label`, `group_description`, `push_label`, `note`) — the app renders notification settings directly from the API response instead of a hardcoded list.
- New push types registered by plugins automatically appear in the app's notification settings screen without any app-side code changes.
- External plugins can use grouping and email linkage by passing the new fields to `tbc_register_push_notification()`.

## v3.31.1
- Moved Push Notification Log to its own **Push Log** tab for better organization.
- Fixed log source tracking — `source` field is now passed explicitly instead of being derived from the `force` flag, preventing external plugin force-sends from being incorrectly logged as 'manual'.
- Used `role__in` for single-query role resolution in manual push audience targeting.
- Fixed `$GLOBALS['wpdb']` → `global $wpdb` for consistency.

## v3.31.0
- **Push Notification Log**: New `wp_tbc_ca_push_log` table tracks all push sends (type, recipients, sent/failed counts, timestamp). Visible in Settings → Statistics tab with 30-day summary stats.
- **Manual Push Notifications**: Admins can send one-time push notifications from Settings → Notifications tab. Supports audience targeting: all users, specific space, role(s), or individual user. Users cannot opt out of manual sends.
- **New notification type**: `space_join_request` — notifies space moderators when someone requests to join a private space (hooks into `fluent_community/space/join_requested`).
- **Extensibility**: Added `tbc_send_push_to_users()` global helper for external plugins to send push notifications via the async Action Scheduler queue. Added `user_configurable` field to notification type registry — types with `user_configurable: false` are hidden from user preferences.
- **Cleanup**: Fixed `on_invitation()` to remove dead `$invitation->email` fallback (FC Invitation model uses `message` field for email). Added daily cron for auto-pruning push logs older than 90 days.

## v3.30.0
- Added YouTube API Key field to Settings → General tab — manage the key from the admin UI instead of wp-config.php
- Removed `TBC_YOUTUBE_API_KEY` constant support — key is now managed entirely from settings

## v3.29.1
- `X-TBC-Profile-Incomplete` header now uses `TBC_REG_META_REGISTRATION_COMPLETE` constant (with string literal fallback when tbc-registration is inactive)

## v3.29.0
- Added `X-TBC-Profile-Incomplete` response header to all authenticated REST responses — app detects profile completion gate mid-session (same pattern as maintenance mode)
- Reads `_tbc_registration_complete` user meta flag (set by tbc-registration) and respects `profile_completion_enabled` admin setting

## v3.28.0
- Added `GET /tbc-ca/v1/cart/count` endpoint — returns WooCommerce cart item quantity for authenticated users
- Added `X-TBC-Cart-Count` response header to all authenticated REST responses (passive badge refresh)

## v3.27.0
- Added `donate` to UI Visibility settings (hides Donate tab per role)
- Added `donor_dashboard` to UI Visibility settings (hides Donor Dashboard menu item per role)

## v3.26.0
- Login API: added `first_name`, `last_name`, `is_verified`, `status` to user object in auth response

## v3.25.0
- Added `tbc_reg_registration_response` filter hook — attaches JWT tokens to tbc-registration registration for mobile clients
- Registration API and OTP API endpoints deprecated (moved to tbc-registration at `tbc-reg/v1`), kept for backward compatibility

## v3.24.3
- Registration API: include `instructions` field from tbc-registration custom fields in `/register/fields` response

## v3.24.2
- Added session cap: max 3 sessions per user, oldest auto-evicted on new login
- Added Tools tab to admin settings with session management
  - Purge All Sessions button (logs out all app users)
  - Per-user session table with individual Log Out buttons

## v3.24.1
- Fixed: WebView cookie leak causing auth crash loop after navigating back from WebView
- Added `maybe_disable_cookie_auth()` on `rest_api_init` (priority 0) — removes WordPress cookie nonce checker when JWT Bearer token is present
- JWT auth always takes precedence when Bearer token is present (no cookie fallback)

## v3.24.0
- Smart App Banner: fixed not showing — was hooked to `wp_head` which doesn't fire in headless mode; now uses `fluent_community/portal_head`
- Smart App Banner: simplified by removing conditional guards for testing
- Smart App Banner: added version comment in HTML output for cache debugging
- Deep linking: fixed `is_community_page()` to match root URL when portal slug is empty
- Deep linking: fixed `get_portal_paths()` to list specific community paths instead of `/*` for root portal

## v3.23.0
- Deep linking: `.well-known/apple-app-site-association` and `.well-known/assetlinks.json` REST endpoints for iOS Universal Links and Android App Links
- Smart App Banner: iOS native meta tag + Android custom banner injected on community pages (toggle in admin settings)
- Admin settings: Deep Linking section with Apple Team ID, Android SHA256 fingerprint, App Store ID, and smart banner toggle
- `/app-config` endpoint now returns `portal_slug` (Fluent Community portal slug for URL mapping)
- `.well-known` requests intercepted at PHP level (works on any web server — no rewrite rules needed)

## v3.22.1
- Added JWT session stats to admin Statistics tab (active sessions, expired, users with sessions)
- Removed backward-compat `token` field from registration response (use `access_token`)
- Updated bundled firebase/php-jwt to latest v6.x from GitHub (was outdated BuddyBoss-era copy)

## v3.22.0
- Self-contained JWT authentication: replaces JWT Authentication for WP REST API plugin dependency
- `POST /tbc-ca/v1/auth/login`: authenticate with username+password, returns access + refresh tokens + user profile
- `POST /tbc-ca/v1/auth/refresh`: exchange refresh token for a new access token (no stored credentials needed)
- `POST /tbc-ca/v1/auth/logout`: revoke session (invalidates both tokens via JTI)
- Access tokens: 1-day expiry, used in Authorization header
- Refresh tokens: 6-month expiry, used to silently obtain new access tokens
- JTI (JWT ID) session tracking in user_meta for per-device logout and token revocation
- `determine_current_user` filter (priority 99) validates Bearer tokens on all REST requests
- Bundled firebase/php-jwt v6 library (no external dependency)
- Login response includes avatar from Fluent Community (eliminates extra profile fetch)
- Registration endpoint now returns access_token + refresh_token pair

## v3.21.0
- Added app version control: admin-configurable minimum app version with force-update gate
- New admin settings: Minimum App Version, iOS App Store URL, Android Play Store URL
- `/app-config` endpoint returns `update` object when min version is set (public, no auth needed)
- App blocks access when running below minimum version, with store links for update

## v3.20.0
- Added response headers on all authenticated REST API responses (any namespace)
- `X-TBC-Unread-Notifications`: unread notification count (Fluent Community)
- `X-TBC-Unread-Messages`: unread message thread count (Fluent Messaging)
- `X-TBC-Maintenance`: maintenance mode flag (1 = show maintenance, 0 = normal)
- Graceful fallback: headers skipped if Fluent Community/Messaging plugins are inactive

## v3.19.1
- Books API: added `?current=1` query parameter to return only the current book (reduces batch payload significantly)

## v3.19.0
- Added batch API endpoint: POST /tbc-ca/v1/batch
- Combines multiple REST requests into a single HTTP call (reduces app startup from ~14 to ~3 requests)
- Cross-namespace dispatch: can batch requests to any WP REST route (Fluent Community, WP Core, TBC plugins)
- JWT from batch request inherited by all sub-requests (no extra auth overhead)
- Max 20 sub-requests per batch, individual error isolation per sub-request
- Requires authentication (JWT)

## v3.18.0
- Added tabbed settings page layout (General, UI Visibility, Notifications, Statistics)
- Tab state persists in URL and after save via query param
- Maintenance mode active indicator (red dot) on General tab when enabled
- Prepares settings page for future expansion

## v3.17.1
- Fixed role-based UI visibility not working for users with multiple WordPress roles
- Now checks all user roles (not just the first) and merges hidden elements across roles
- Also fixed maintenance bypass role check for multi-role users

## v3.17.0
- Consolidated admin menu: top-level "TBC Community App" menu replaces Settings submenu
- Other TBC plugins (Registration, Multi Reactions, OTP Verification) nest as submenus
- Registers at priority 9 so child plugins can attach at default priority

## v3.16.0
- Added maintenance / coming soon mode with role-based bypass
- Admins always bypass maintenance; additional bypass roles configurable
- Added role-based UI visibility (hide cart, menu items per WP role)
- Extended /app-config endpoint with maintenance + visibility flags (auth-aware)
- New admin settings sections for maintenance mode and UI visibility

## v3.15.1
- Fixed bookmark timestamp validation to allow bookmarking at 0:00 (start of audio)
- Fixed PHP 8+ crash: wrapped floatval sanitize_callback in closure (WP passes 3 args)

## v3.15.0
- Migrated YouTube from dead RSS feed to YouTube Data API v3
- GET /youtube/latest — now uses uploads playlist via playlistItems.list
- GET /youtube/playlists — new endpoint, returns all channel playlists
- GET /youtube/playlists/{id}/videos — new endpoint, returns videos in a playlist
- API key via TBC_YOUTUBE_API_KEY constant or tbc_ca_youtube_api_key option
- 6-hour transient caching per endpoint (minimal quota usage)
- Removed RSS XML parsing (parse_rss method)

## v3.14.0
- Added moderator profile to book detail API response
- Returns user_id, display_name, username, avatar, is_verified from Fluent Community xprofile
- Enables moderator display with avatar + profile link in mobile app

## v3.13.0
- Added next_meeting to books list API response for current book
- Server calculates next upcoming meeting from schedule_data
- Includes formatted_date, time, chapters, and meeting_link
- Only present when both a future schedule entry AND meeting link exist

## v3.12.0
- Added Book Club audiobook REST endpoints for mobile app
- GET /books — list all books (lightweight, no audio URLs)
- GET /books/{id} — full book detail with chapters, bookmarks, meeting info
- POST /books/{id}/bookmarks — create bookmark at playback position
- DELETE /books/{id}/bookmarks/{bookmark_id} — delete user's own bookmark
- Reads from existing TBC Book Club plugin tables (wp_tbc_bc_books/bookmarks)
- All endpoints require JWT authentication

## v3.11.0
- Added YouTube latest videos REST endpoint
- GET /youtube/latest — fetches latest videos from YouTube channel RSS feed
- Server-side caching via WordPress transients (6 hours)
- Channel ID configurable via wp_options (tbc_ca_youtube_channel_id)
- No API key required — uses public YouTube RSS feed

## v3.10.0
- Added account management REST endpoints
- POST /account/deactivate — soft-deactivate Fluent Community profile (reversible)
- DELETE /account/delete — permanently delete WordPress user + all Fluent data
- Admin accounts protected from app-side deletion

## v3.9.0
- Replaced /theme/colors with /app-config endpoint
- Returns theme colors + admin-enabled social link providers in one call
- Extensible for future app configuration settings

## v3.8.0
- Push notification feature-gating and new notification types
- Added feature_flag property to notification types (maps to FC module config)
- Feature-gated types (followers, leaderboard, courses) auto-hidden from API when module disabled
- Admin settings page shows grayed-out rows with "FEATURE DISABLED" badge for disabled modules
- Hooks for disabled features no longer registered (avoids wasted processing)
- Added new_direct_message push notification (Fluent Messaging: after_add_message)
- Added course_enrolled push notification (FC Pro: course/enrolled)
- Frontend: combined reaction_on_post + reaction_on_comment into unified "Reactions" card
- Frontend: added messaging category with DM notification toggle

## v3.7.0
- FluentCommunity 2.2.01 compatibility update
- Fixed on_invitation: FC passes 1 arg (inviter is $invitation->user_id, not a separate param)
- Fixed on_points_earned: FC passes ($xprofile, $oldPoints), compute delta from total_points
- Added push notification for comment reactions (new FC 2.2.01 hook: comment/react_added)

## v3.6.1
- Added fcom_badge_slugs / fcom_author_badge_slugs to WP REST API user + comment fields

## v3.6.0
- Added Fluent Community avatar + verified status to WP REST API (register_rest_field)
- Embeds fcom_avatar/fcom_is_verified on user objects (posts via _embed)
- Embeds fcom_author_avatar/fcom_author_is_verified/fcom_author_slug on comments
- Eliminates N+1 profile API calls from mobile blog feature

## v3.5.0
- Fixed members directory sort: Joining Date (created_at) now sorts newest first (DESC)

## v3.4.0
- Added badge definitions REST endpoint (/badge-definitions) for profile badges

## v3.3.0
- Added unread notification count (badge) to push notification payloads

## v3.2.0
- Added universal OTP REST endpoints (verify, resend, voice) for all flows

## v3.1.0
- Added OTP password reset endpoints (forgot, verify, reset)
- Added email verification during registration (respects tbc-otp-verification settings)

## v3.0.5
- Added dedicated avatar update endpoint using native Fluent models

## v3.0.4
- Fixed registration avatar upload (sync XProfile after user creation)

## v3.0.1
- Added Fluent Community portal header hiding for app WebView

## v3.0.0
- Restructured into multi-file plugin
- Added push notification system with Firebase
- Added admin settings page
- Added notification registry (extensible)
- Added user notification preferences
- Added device token management
- Hooked into Fluent Community events

## v2.0.0
- Migrated to JWT authentication (uses JWT Authentication for WP REST API plugin)
- Removed app password creation (no longer needed)
- Removed /login endpoint (now using /wp-json/jwt-auth/v1/token)
- Kept web session, cart, and app view styling features

## v1.3.0
- Added app view mode (hide header/footer in WebView)

## v1.2.0
- Fixed permission callback for Basic Auth compatibility

## v1.1.0
- Added web session and cart endpoints

## v1.0.0
- Initial release
