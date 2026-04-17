=== TBC OTP ===
Contributors: twobirdscommunity
Tags: otp, twilio, two-factor, registration, fluent-community
Requires at least: 5.8
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Phone OTP verification for Fluent Community registration, powered by Twilio Verify. Optional email 2FA and voice-call fallback.

== Description ==

TBC OTP adds a phone-number verification step to Fluent Community registrations. When a new user registers, they receive a one-time code via SMS (and optionally voice call) through the Twilio Verify service. Registration is only completed after the code is confirmed.

Designed to pair with the TBC Community App mobile client — the REST endpoints work for both the web registration form and the native app's onboarding flow.

= Core Features =

* **Phone OTP on registration** — SMS code required before the WP user account is created
* **Twilio Verify integration** — Uses Twilio's managed Verify service (no raw messaging — you get rate limiting, fraud protection, and delivery reporting for free)
* **Voice fallback (optional)** — Users who don't receive SMS can request a voice call with the code
* **Email 2FA (optional)** — Alternate email-based code flow for regions where SMS is unreliable
* **Duplicate phone restriction (optional)** — Block re-use of a phone number across accounts
* **Blocked numbers list** — Reject specific phone numbers or prefixes
* **One-click phone field setup** — Creates and wires up a Fluent Community phone custom field automatically
* **REST API** — `tbc-otp/v1` namespace with send, verify, resend, and voice endpoints for web + mobile clients
* **Admin settings page** — Twilio credentials, toggles, and phone-field picker under the TBC Community App menu

== Installation ==

1. Ensure Fluent Community is installed and activated.
2. Upload the `tbc-otp` folder to `/wp-content/plugins/`.
3. Activate the plugin through the Plugins menu.
4. Go to **TBC Community App → OTP** in wp-admin.
5. Create a Twilio account and a Verify service (see FAQ below), then paste your **Account SID**, **Auth Token**, and **Verify Service SID** into the settings page.
6. Use the **Set up phone field** button to auto-create the Fluent Community phone custom field (or select an existing one).
7. Toggle **Enable phone OTP on registration** on.

== Frequently Asked Questions ==

= How do I get a Twilio Verify Service SID? =

1. Sign up at https://www.twilio.com/ and verify your account.
2. In the Twilio console, open **Verify → Services → Create new Service**.
3. Give it any name (e.g. "MyCommunity Verify") and save.
4. Copy the **Service SID** (starts with `VA...`) into the plugin's **Verify Service SID** field.
5. From the main Twilio dashboard, copy your **Account SID** (`AC...`) and **Auth Token** into the matching fields.
6. You do NOT need to buy a phone number for Verify — Twilio routes codes automatically.

= Does this work with the TBC Community App mobile client? =

Yes. The REST endpoints at `tbc-otp/v1` support the app's onboarding flow. The mobile app reads the `tbc_ca_registration_config` filter to know OTP is required.

= Can I enable OTP without selecting a phone field? =

No — the plugin blocks enabling OTP until a phone field slug is configured, because the phone number has to come from somewhere. Use the one-click setup button or pick an existing Fluent Community custom field.

= Does Twilio Verify cost money? =

Twilio charges per verification attempt. Pricing varies by destination country — check https://www.twilio.com/verify/pricing for current rates. Trial accounts include free credits to get started.

= What happens when I uninstall? =

By default, nothing is removed on uninstall — your Twilio credentials and settings stay in the database so you can deactivate/reinstall for testing without losing your configuration. If you want a full wipe on uninstall, enable **Delete data on uninstall** on the admin settings page (under Data Management) before deleting the plugin.

== Changelog ==

= 1.0.0 =
* Initial public release
* Twilio Verify integration for SMS OTP during registration
* Optional voice call fallback and email 2FA flows
* One-click Fluent Community phone field setup
* Duplicate phone number restriction and blocked-numbers list
* REST API endpoints for web + mobile app registration flows
* Admin settings page under the TBC Community App menu

== Upgrade Notice ==

= 1.0.0 =
Initial release.
