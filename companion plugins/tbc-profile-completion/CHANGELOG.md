# Changelog

## 1.1.0 — 2026-04-16

### Improved
- Social links fields now render with provider icon chip, domain prefix, and compact username input — aligned with the TBC native app and Fluent's native profile UI
- Placeholders now use Fluent's verbatim format (`instagram @username`, `fb_username`, etc.) instead of full URL placeholders

## 1.0.0 — 2026-04-15

Initial release.

### Features
- Profile completion gate requiring bio and/or avatar before community access
- Persistent full-page overlay injected directly on Fluent Community portal pages — no dedicated shortcode page needed
- Cover photo banner + avatar overlap layout matching the real FC profile page
- Bio textarea with live character counter
- Social links section that reads FC's enabled social providers automatically
- Uses Fluent Community's native media upload flow and profile endpoints (`feeds/media-upload` + `/profile/{username}`) for full consistency with FC's own data store
- Avatar detection delegates to FC's native `XProfile::hasCustomAvatar()` so we read the raw uploaded-avatar column directly instead of pattern-matching against FC's generated Gravatar / ui-avatars / Photon-proxied fallback URLs. Same source of truth FC uses for its own compilation-score profile completion.
- FC CSS variable theming with automatic light/dark mode support
- Semi-transparent backdrop with blur — site stays visible behind the card
- Advertises capability via `tbc_ca_registration_config` filter in `/app-config` so the mobile app knows the feature is active
- Marks new users as incomplete via `tbc_ca_post_register` action
- Re-evaluates completion on every profile save: hooks `fluent_community/update_profile_data` (signature `$updateData, $data, $xProfile`) and the XProfile model save event so the gate lifts automatically when requirements are met
- `X-TBC-Profile-Incomplete` REST response header for mobile app gate routing
- Web redirect for incomplete profiles on non-FC pages (template_redirect → FC portal)
- Optional FC native onboarding widget suppression (feature flag + `compilation_score` override)
- Admin settings page nested under the TBC Community App menu
- Data management with optional cleanup on uninstall
