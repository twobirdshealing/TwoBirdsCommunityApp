# Changelog

All notable changes to the TBC Fluent Profiles plugin.

## v2.6.1
- Added `profile_completion` settings to `/register/fields` REST response — includes `enabled`, `require_bio`, `require_avatar` so the mobile app can adapt the registration flow based on gate configuration

## v2.6.0
- Renamed all transient session prefixes from `tbc_otp_*` to `tbc_fp_*` (session, recovery, profile)
- Renamed API payload field from `tbc_otp_session_key` to `tbc_fp_session_key`
- Renamed HTTP header from `X-TBC-OTP-Session` to `X-TBC-FP-Session`
- Removed one-time `tbc_otp_*` → `tbc_fp_*` option prefix migration (no longer needed for fresh installs)
- Cleaned up uninstall.php: removed legacy `tbc_otp_*` option deletion and migration flag cleanup

## v2.5.2
- Added "Delete all plugin data when uninstalled" setting in Data Management section — uninstall preserves all data by default to prevent accidental data loss during troubleshooting or reinstalls
- Added `uninstall.php` — when opted in, removes settings, field definitions, OTP config, user meta (custom field values + registration complete flag), OTP transients, and SMS roles

## v2.5.1
- **Fix: Profile completion gate now validates required fields** — `POST /register/complete` checks `get_missing_fields()` before marking complete; returns 422 with missing fields if avatar/bio not uploaded (previously blindly set flag to '1')
- **Fix: Avatar required in registration flow** — mobile app avatar step now validates avatar is uploaded before allowing completion (client-side + server-side guard)
- **Fix: FC onboarding disable filter priority** — bumped `fluent_community/portal_vars` filter to priority 999 so it runs after FC Pro and other plugins that may re-enable the onboarding widget
- **Fix: Avatar placeholder detection** — FC stores a placeholder image URL for users without a custom avatar; `get_missing_fields()` now detects this as "no avatar" instead of treating it as a valid upload. Placeholder also stripped from `existing.avatar` in REST API + shortcode config
- **Fix: Web profile completion validates avatar** — `profile-completion.js` now checks avatar is uploaded when required (matches mobile); respects `requireAvatar` config from server

## v2.5.0
- **SMS Role Management** — automatic `sms_in` / `sms_out` role assignment based on a configurable profile field (replaces Uncanny Automator dependency)
  - On registration: assigns role based on SMS opt-in field value
  - On profile edit: updates role when the opt-in field changes (both FC portal and AJAX save paths)
  - New admin settings under OTP/Twilio tab: SMS Opt-In Field dropdown + Opt-In Value text input
  - Registers `sms_in` and `sms_out` roles on activation (with safety net for existing installs)

## v2.4.9
- Moved admin menu under TBC Community App as a submenu (matches Multi Reactions, Book Club, etc.) with fallback to top-level if TBC Community App is not active

## v2.4.8
- Removed ~43 debug `error_log('[TBC-FP GATE DEBUG]')` calls from production code (class-registration-page, class-core, class-registration-api)
- Fixed spinner CSS class bug in profile-completion.js (`tbc-reg__spinner-inline` → `tbc-reg__spinner tbc-reg__spinner--inline`)
- Removed 3 `console.log` calls from registration.js that exposed registration payloads
- Defined `TBC_FP_META_REGISTRATION_COMPLETE` constant — replaces 12+ hardcoded `'_tbc_registration_complete'` string literals
- Added XProfile + completion result caching on RegistrationPage (eliminates redundant DB queries per request)
- Fixed `handle_status()` redundant XProfile query — reuses already-loaded data instead of creating new RegistrationPage
- Added dual-hook deduplication guard (`$reevaluated_users`) — prevents double re-evaluation when both filter and model event fire
- Unified `get_missing_fields()` with `$overrides` parameter — filter handler delegates instead of inline reimplementation
- Fixed `remove_all_filters('wp_mail_content_type')` removing third-party filters — now stores and removes only our closure
- Modernized profile-completion.js from `var` to `const`/`let`

## v2.4.7
- Added site logo above profile completion form card (same FC portal logo / WP Customizer fallback as registration form)

## v2.4.6
- Step 2 (Personalize) UI overhaul — avatar now overlaps cover photo (profile header layout), centered like the actual profile
- Avatar hover overlay ("Change") added, matching cover photo's existing overlay
- Remove (X) buttons on both avatar and cover photo — can now clear images, not just replace
- Avatar gets white border + shadow to stand out against cover photo

## v2.4.5
- Fixed social providers not loading — `socialLinkProviders()` returns an associative array keyed by provider slug, not `$provider['key']`

## v2.4.4
- Web profile completion form now uses FC's actual social link provider keys (`fb`, `blue_sky`, `reddit`, etc.) instead of wrong hardcoded ones (`facebook`, `linkedin`)
- Social providers are dynamically injected from `ProfileHelper::socialLinkProviders()` — matches whatever's enabled in FC admin, no hardcoded fallback
- Social Links section hidden on web form if no providers are enabled

## v2.4.3
- Fixed cover photo, social links, and website not pre-loading in profile completion form — these fields are stored in XProfile's serialized `meta` column, not as direct columns (only `avatar` and `short_description` are direct)
- Both web shortcode and `GET /register/status` endpoint now read from `$xprofile->meta` for cover_photo, social_links, and website

## v2.4.2
- `GET /register/status` endpoint now returns `existing` field with full profile data (bio, website, social_links, avatar, cover_photo) for app pre-population
- App `ProfileCompletionSteps` component pre-loads existing profile data (bio, website, social links, avatar, cover photo) from status endpoint
- App profile completion screen shows adaptive subtitle ("Update your..." vs "Add a...")
- AuthContext stores existing profile data from login status check, passes through to completion screen

## v2.4.1
- Profile completion gate now checks **all users** (not just those who registered through our flow) — any user missing required fields gets gated
- Profile completion form pre-loads existing profile data (bio, website, social links, avatar, cover photo) so users don't lose existing info
- Cover photo shows "Change Cover Photo" overlay on hover when an image already exists
- Wording adapts: "Update your profile photo" when photos exist, "Add a profile photo" when empty
- Added extensive debug logging (`[TBC-FP GATE DEBUG]`) across all gate methods for troubleshooting
- Fixed missing closing brace in `reevaluate_profile_completion()` causing PHP parse error

## v2.4.0
- **Profile Completion Gate** — unified system across web and app that requires users to complete their profile (bio + avatar) before accessing the community
  - Smart gate helper (`is_registration_complete()`) checks XProfile data and auto-marks users complete
  - `[tbc_profile_completion]` shortcode for logged-in incomplete users (standalone bio + avatar form)
  - `GET /tbc-fp/v1/register/status` endpoint for mobile app login gate
  - Profile save re-evaluation hook — dynamically re-gates users who remove their bio/avatar
  - New "Profile Completion" admin tab: enable/disable gate, disable FC onboarding widget, toggle required fields (bio, avatar)
  - `profile-completion.js` — standalone web form reusing registration CSS
- **Settings prefix migration** — all `tbc_otp_*` options renamed to `tbc_fp_*` with one-time migration on upgrade
- Steps 5-6 (bio + avatar) extracted from `registration.js` into `profile-completion.js` — registration form ends at step 4
- `[tbc_registration]` shortcode no longer uses `?tbc_reg_step=complete` resume; hides when logged in + incomplete
- Gate redirects use clean URL (no query params)
- `uninstall.php` cleans up both `tbc_fp_*` and legacy `tbc_otp_*` options
- **App**: `ProfileCompletionSteps` shared component, `profile-complete` route, AuthContext login gate with `checkProfileComplete()`

## v2.3.1
- Phone Field setting now auto-detects phone-type fields from Profile Fields
- Replaced manual meta key text input with smart dropdown: Auto-detect | specific phone fields | Custom meta key
- Default is auto-detect mode — no configuration needed if you have a Phone-type field

## v2.3.0
- Removed legacy backward-compatibility code for old tbc-otp-verification plugin
- Deleted `class-registration-legacy.php` (FC form injection path no longer needed)
- Removed `skip_otp` mode from Core, Admin, and main plugin file
- OTP/Twilio tab now always visible in admin settings (no longer conditionally hidden)
- Cleaned up internal migration comments from class docblocks
- Admin menu always registers as top-level (removed tbc-community-app nesting check)

## v2.2.12
- Fixed step 5 422 "Invalid username" error — now sends `username` in profile POST body to prevent FC's `can_customize_username` null-comparison bug
- Version bump to bust browser cache for JS fix

## v2.2.11
- Fixed step 5 (bio + social links) 422 error on resume — first_name was empty because formData was lost after page refresh
- Resume config now passes first_name/last_name from logged-in WordPress user
- saveStep5() uses stored name fields on resume, falls back to full_name split for normal flow

## v2.2.10
- Fixed password strength meter not updating as you type — bar and label now update live on every keystroke (DOM update without full re-render)

## v2.2.9
- Removed 6-character minimum password requirement — any password is now accepted
- Enhanced password strength meter with gradual 6-tier scoring (very weak → very strong) instead of binary threshold
- Strength meter is now advisory only, never blocks form submission
- Removed misleading "Min. 6 characters" placeholder text

## v2.2.8
- Fixed missing logo on registration page — now pulls from Fluent Community portal settings (same logo as the FC login page), with WordPress Customizer logo as fallback

## v2.2.7
- Fixed registration form losing theme colors on Default page template — now injects FC CSS variables directly in the shortcode output (same approach as FC's native auth pages)
- Registration page can now use "Default template" (no sidebar/nav, matches login page) while keeping full light/dark mode theming

## v2.2.6
- Fixed bio, website, and social links not saving on web registration step 5 — was using PUT (routes to `patchProfile`, avatar/cover only) instead of POST (routes to `updateProfile`, all fields)
- Added `fcPost` JSON helper for FC API calls alongside existing `fcPut` and `fcPostForm`

## v2.2.5
- Fixed confusing "Disable Email Verification" double-negative checkbox — renamed to "Email Verification" / "Require email verification during registration" (checked = on, unchecked = off, matching all other toggles)
- Renamed option key from `disable_email_verification` → `enable_email_verification` with inverted logic and default `true`

## v2.2.4
- Added bio (required) and website (optional) fields to registration step 5 — both web and mobile app
- Step 5 renamed from "Social Links" to "About You" — bio textarea + website input shown above social links
- Bio is required before continuing; "Skip for now" button removed
- Bio saved as `short_description`, website saved as `website` via existing `PUT /profile/{username}` endpoint
- No new API endpoints needed — uses existing FC profile update

## v2.2.3
- Admin field editor now hides Placeholder setting for Radio, Checkbox, and Multi-Select types (not applicable)
- Fixed terms & conditions checkbox: now renders as a clickable link to the privacy policy page (matching FC's native behavior)
- Changed `wp_strip_all_tags()` → `wp_kses_post()` for terms `inline_label` to preserve safe HTML links

## v2.2.2
- Added Checkbox field type support on registration form (renders as checkbox group, saves as JSON array)
- Added Multi-Select field type support on registration form (renders as `<select multiple>`, saves as JSON array)
- Fixed required validation for multi-value fields (empty array now correctly triggers "required" error)
- Updated `signup_type` for checkbox/multiselect in field registry (no longer skipped)

## v2.2.1
- Fixed radio fields (e.g. SMS Opt In) rendering as dropdown `<select>` instead of radio buttons
- Fixed registration completion gate not working on FC portal SPA pages (Feed, My Spaces, etc.) — injected redirect script via `fluent_community/before_js_loaded` hook to catch SPA page loads
- Added radio button CSS styles (`.tbc-reg__radio-group`, `.tbc-reg__radio-label`)

## v2.2.0
- Fixed "Done" redirect going to `/portal/` (404) — now uses FC's `Helper::baseUrl()` which correctly resolves the portal URL regardless of slug configuration
- Fixed login URL construction to also use `Helper::baseUrl()`
- Added registration completion gate: new users must finish steps 5-6 (social links + avatar) before accessing the site
- New `_tbc_registration_complete` user meta flag — set to `'0'` on account creation, `'1'` when user clicks Done/Skip
- New `POST /register/complete` endpoint to mark registration as finished
- `template_redirect` hook bounces incomplete users back to the registration page (existing users unaffected)

## v2.1.2
- Fixed avatar/cover upload URL extraction: FC's `/feeds/media-upload` returns `{ media: { url } }`, not `{ url }` at top level

## v2.1.1
- Fixed social links 404: changed from `PATCH` to `PUT /profile/{username}` with `{ data: { social_links } }` (matching FC's actual route)
- Fixed avatar/cover upload 404: two-step process matching mobile app — `POST /feeds/media-upload` then `PUT /profile/{username}` with returned URL
- Added `fcPut()` and `fcPostForm()` helpers for FC API calls
- Added `FC_API` base URL constant

## v2.1.0
- Fixed post-registration 403 on social links + avatar upload (steps 5-6)
- Root cause: WordPress REST nonce can't be generated in the same request as `wp_set_auth_cookie()` — `$_COOKIE` session token mismatch
- Solution: page reload after registration (`?tbc_reg_step=complete`). Cookie is in browser on reload, WP generates valid nonce, steps 5-6 work natively
- Shortcode detects `?tbc_reg_step=complete` + `is_user_logged_in()` → passes `resumeStep: 5` + username to JS
- Removed `/register/nonce` endpoint (no longer needed)
- Follows same pattern as Fluent Community's native registration (cookie + page reload, not REST nonce tricks)

## v2.0.6
- Added password show/hide toggle (eye icon) on password and confirm password fields
- Added password strength meter with visual bar (weak/medium/strong) and label
- Shows "Min. 6 characters" hint when password field is empty
- Fixed `/register/fields` endpoint to include custom profile fields (phone, pronouns, gender, state, city, sms_opt_in) from `get_fields_for('signup')`

## v2.0.3
- Fixed CSS class name mismatches between `registration.css` and `registration.js`
- Added padding to `.tbc-reg__card`, step indicator bars, link styles, alert banners, code input, checkbox, media/avatar sections
- All CSS classes now match exactly what the JS renders

## v2.0.2
- Fixed registration CSS not loading on FC frame template pages — CSS is now inlined as a `<style>` tag directly in the shortcode output (reads from `registration.css` on disk)
- Removed `wp_enqueue_scripts` / `enqueue_global_assets` hooks for registration (no longer needed)
- JS loaded via inline `<script defer>` tag in shortcode

## v2.0.1
- Attempted external CSS loading fix (insufficient for FC frame templates)

## v2.0.0
- **Major: Unified plugin** — merged tbc-otp-verification into tbc-fluent-profiles
- Added OTP verification (Twilio): registration, password recovery, profile phone change
- Added unified REST OTP endpoints at `tbc-fp/v1/otp/verify|resend|voice` (replaces legacy AJAX handlers)
- Added Registration REST API at `tbc-fp/v1/register` and `tbc-fp/v1/register/fields` (moved from tbc-community-app)
- Added `[tbc_registration]` shortcode — multi-step web registration form (6 steps, mirrors mobile app)
- Added registration.css with Fluent Community CSS variable theming
- Added tabbed admin page: Profile Fields + OTP/Twilio settings in one screen
- Updated otp-handler.js to use REST endpoints (removed AJAX, removed registration XHR interception)
- JWT tokens for mobile registration via `tbc_fp_registration_response` filter (hooked by tbc-community-app)
- Web registration uses `wp_set_auth_cookie()` directly (no JWT needed)
- Legacy mode: if tbc-otp-verification is still active, skips OTP init to avoid conflicts (admin warning shown)
- Backward compatible: old FC form injection registration still works in legacy mode

## v1.1.3
- Added field instructions text on signup/registration page via JS injection (FC FormBuilder doesn't support instructions natively)
- Moved "Who can see this:" visibility dropdown below field label on profile edit (was below input)
- Added `wp_head`/`wp_footer` hooks for auth pages (portal hooks don't fire on registration page)

## v1.1.2
- Fixed select/dropdown fields (Gender, Multi-Select, Visibility) having green background instead of white on profile edit form
- Fixed select option text appearing gray instead of black (CSS specificity issue with .el-input__inner transparent background)

## v1.1.1
- Added Non-Binary and Other to gender field fixed options (Male, Female, Non-Binary, Other, Prefer not to say)

## v1.1.0
- Moved admin page under consolidated "TBC Community App" top-level menu
- Falls back to Settings submenu if tbc-community-app is not active

## v1.0.0
- Initial release
