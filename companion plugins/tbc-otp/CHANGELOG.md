# Changelog

## 1.4.0 — 2026-03-18

### Changed
- **Web registration: pre-submit OTP** — Complete rewrite of the web registration flow. OTP verification now happens BEFORE the form is submitted. JS intercepts the submit button click, verifies phone via REST `/otp/send` endpoint, then lets the form submit once with the session key. FC's native flow (email 2FA, redirects, success) runs completely untouched.
- Simplified `intercept_web_registration` to a server-side safety net — just validates the session key, no longer starts Twilio or returns OTP-required responses.
- Removed XHR response parsing/replay logic — no more guessing FC's response format.

### Added
- `POST /tbc-otp/v1/otp/send` REST endpoint — validates phone (format, duplicates, blocked), starts Twilio verification, returns session key. Used by web JS before form submission.
- `phone_slug` in frontend JS config for DOM phone field lookup.

## 1.2.2 — 2026-03-18

### Fixed
- Web registration replay: hybrid approach — tries clicking FC's submit button (with Vue state reset) first, falls back to direct XHR replay after 1.5s timeout. XHR interceptor injects `tbc_otp_session_key` into outgoing FormData when `otpVerified` flag is set. Improved response handling for `wp_send_json_success/error` format, FC email 2FA detection, and console logging for debugging.

## 1.2.0 — 2026-03-18

### Added
- Web registration OTP interception: XHR monkey-patch (`registration-otp.js`) intercepts FC's native AJAX registration, shows OTP modal overlay, and replays form with session key
- OTP modal CSS (`otp-modal.css`) themed with FC CSS variables
- Frontend class (`class-frontend.php`) to enqueue OTP assets on FC auth and portal pages

### Removed
- SMS role management (sms_in / sms_out) — moved to site-specific plugin
- Password recovery OTP
- Profile phone change OTP

## 1.0.0 — 2026-03-18

Initial release — extracted from tbc-registration as a standalone add-on plugin.

### Features
- Phone OTP verification via Twilio Verify API (SMS + voice call fallback)
- Registration interception via `tbc_ca_pre_register` filter (app) and AJAX hook (web)
- OTP REST endpoints: verify, resend, voice (`tbc-otp/v1/otp/*`)
- Phone duplicate prevention and blocked number list
- SMS role management (sms_in / sms_out) based on configurable profile field
- Advertises OTP capability via `tbc_ca_registration_config` filter in `/app-config`
- Admin settings page under TBC Community App menu
- Data management with optional cleanup on uninstall
