# Changelog

## 1.2.9 — 2026-03-18

### Fixed
- **Profile save failing** — Split single PUT request into POST (text fields) + PUT (media URLs) to match FC's native API. Bio, social links, and name are saved via POST (`updateProfile`); avatar and cover photo URLs are saved via PUT (`patchProfile`). Previously all fields were sent via PUT, which only processes media — bio and social links were silently ignored.
- **"Invalid username" error** — Include `username` in the POST payload so FC's `can_customize_username` validation doesn't treat a missing field as a username change attempt.
- **Better error messages** — Error responses from the server are now parsed and displayed instead of generic "Failed to save profile."

## 1.2.4 — 2026-03-18

### Fixed
- **Photo uploads** — Avatar and cover photo uploads now use FC's two-step flow: upload file to `feeds/media-upload`, then save the returned URL to the profile. Previously sent files directly to the profile endpoint which only accepts JSON with URLs.
- **Profile save 404** — Profile PUT/POST calls now include the username in the path (`/profile/{username}`) as required by FC's REST API.
- **Profile save 422** — Request body now wrapped in `{ data: { ... } }` to match FC's expected format. Also includes `first_name` and `last_name` (required by FC) in bio/socials save.

## 1.2.0 — 2026-03-18

### Changed
- **Profile-preview layout** — Cover photo banner + avatar overlapping (like the actual profile). Cover photo clickable to upload. Avatar with camera badge. User name shown beside avatar.
- Semi-transparent overlay with backdrop blur — site visible behind the card
- More compact layout: smaller card (420px), tighter spacing
- Social links collapsed behind a toggle ("+ Add social links") to reduce visual clutter

### Fixed
- FC onboarding disable: added CSS fallback + user onboarding_progress override (feature flag alone wasn't enough)

## 1.1.0 — 2026-03-18

### Changed
- **Overlay approach** — Profile completion is now a persistent full-page overlay injected directly on FC portal pages. No separate shortcode page needed. User sees a clean card with avatar upload, bio textarea, and optional social links.
- Redirects non-FC pages to the FC portal where the overlay shows automatically.
- Legacy `[tbc_profile_completion]` shortcode still works for backwards compat.

### Added
- Avatar upload with preview (uses FC's media upload + profile endpoints)
- Bio textarea with character counter
- Social links section (reads FC's enabled providers)
- FC CSS variable theming (light/dark mode support)

## 1.0.0 — 2026-03-18

Initial release — extracted from tbc-registration as a standalone add-on plugin.

### Features
- Profile completion gate requiring bio and/or avatar before community access
- Advertises capability via `tbc_ca_registration_config` filter in `/app-config`
- Marks new users as incomplete via `tbc_ca_post_register` action
- Re-evaluates completion on every profile save (filter + model event)
- X-TBC-Profile-Incomplete response header for mobile app redirect
- Web redirect for incomplete profiles (template_redirect + FC portal SPA)
- [tbc_profile_completion] shortcode for web profile completion form
- Optional FC native onboarding widget suppression
- Admin settings page under TBC Community App menu
- Data management with optional cleanup on uninstall
