# Changelog

All notable changes to the TBC Community App plugin.

## v3.30.0
- Added YouTube API Key field to Settings → General tab — manage the key from the admin UI instead of wp-config.php
- Removed `TBC_YOUTUBE_API_KEY` constant support — key is now managed entirely from settings

## v3.29.1
- `X-TBC-Profile-Incomplete` header now uses `TBC_FP_META_REGISTRATION_COMPLETE` constant (with string literal fallback when tbc-fluent-profiles is inactive)

## v3.29.0
- Added `X-TBC-Profile-Incomplete` response header to all authenticated REST responses — app detects profile completion gate mid-session (same pattern as maintenance mode)
- Reads `_tbc_registration_complete` user meta flag (set by tbc-fluent-profiles) and respects `profile_completion_enabled` admin setting

## v3.28.0
- Added `GET /tbc-ca/v1/cart/count` endpoint — returns WooCommerce cart item quantity for authenticated users
- Added `X-TBC-Cart-Count` response header to all authenticated REST responses (passive badge refresh)

## v3.27.0
- Added `donate` to UI Visibility settings (hides Donate tab per role)
- Added `donor_dashboard` to UI Visibility settings (hides Donor Dashboard menu item per role)

## v3.26.0
- Login API: added `first_name`, `last_name`, `is_verified`, `status` to user object in auth response

## v3.25.0
- Added `tbc_fp_registration_response` filter hook — attaches JWT tokens to tbc-fluent-profiles registration for mobile clients
- Registration API and OTP API endpoints deprecated (moved to tbc-fluent-profiles at `tbc-fp/v1`), kept for backward compatibility

## v3.24.3
- Registration API: include `instructions` field from tbc-fluent-profiles custom fields in `/register/fields` response

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
- Other TBC plugins (Fluent Profiles, Multi Reactions, OTP Verification) nest as submenus
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
