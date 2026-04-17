# Changelog

## 1.0.0 — 2026-04-15

Initial release.

### Features
- Phone OTP verification via Twilio Verify API (SMS + voice call fallback)
- App registration: intercepts `tbc_ca_pre_register` to require OTP before account creation
- Web registration: pre-submit OTP flow — JS intercepts the FC submit button, verifies phone via REST, then lets FC's native form submit once with the session key (email 2FA, redirects, and success states untouched)
- OTP REST endpoints under `tbc-otp/v1`: `otp/send`, `otp/verify`, `otp/resend`, `otp/voice`
- Phone duplicate prevention and blocked number list
- Admin settings page under TBC Community App menu with phone field selector, settings validation, and persistent warning when misconfigured
- Detects when Fluent Community's Custom Profile Fields feature is disabled and offers a one-click setup: enables the feature, creates a `_phone` field, and links it to OTP in a single click (requires Fluent Community Pro)
- Optional Email 2FA toggle (positive logic, nested under Registration OTP)
- Advertises OTP capability to the mobile app via `tbc_ca_registration_config` filter in `/app-config`
- OTP modal UI themed with Fluent Community CSS variables
- Data management with optional cleanup on uninstall
