=== TBC Profile Completion ===
Contributors: twobirdscommunity
Tags: profile, registration, onboarding, fluent-community, gate
Requires at least: 5.8
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Profile-completion gate for Fluent Community. Requires new members to finish their profile (bio, avatar, etc.) before they can access the community.

== Description ==

TBC Profile Completion blocks access to Fluent Community until a new member fills out the required parts of their profile. Configurable requirements include bio text and a real avatar (not the fallback placeholder). Integrates with Fluent Community's own onboarding step so users don't see two sequential "complete your profile" prompts.

Designed to pair with the TBC Community App mobile client — a REST endpoint and response header let the native app detect incomplete profiles and render its own completion screen.

= Core Features =

* **Profile completion gate** — Overlay on the Fluent Community portal until required fields are filled
* **Configurable requirements** — Toggle requirements for bio and real avatar from the admin page
* **Fluent Community onboarding handoff** — Option to suppress FC's built-in onboarding step so users only see this plugin's gate
* **Real avatar detection** — Distinguishes actual uploads from auto-generated placeholder avatars
* **REST API** — `tbc-pcom/v1/status` and `tbc-pcom/v1/complete` endpoints for web + mobile clients
* **Mobile app header** — `X-TBC-Profile-Incomplete` response header on authenticated API calls so the native app knows to prompt the user
* **Admin settings page** — Toggles live under the TBC Community App menu
* **Opt-in data removal** — Uninstall leaves user data untouched unless you explicitly enable the "Delete data on uninstall" option

== Installation ==

1. Ensure Fluent Community is installed and activated.
2. Upload the `tbc-profile-completion` folder to `/wp-content/plugins/`.
3. Activate the plugin through the Plugins menu.
4. Go to **TBC Community App → Profile Completion** in wp-admin.
5. Enable the gate and pick which fields are required (bio, avatar).
6. (Optional) Enable **Disable Fluent Community onboarding step** if you want to replace FC's built-in onboarding with this gate.

== Frequently Asked Questions ==

= Does this require Fluent Community? =

Yes. The gate hooks into Fluent Community's portal and profile system — it won't do anything without FC installed.

= Does it work with the TBC Community App mobile client? =

Yes. The mobile app reads the `X-TBC-Profile-Incomplete` response header on authenticated API calls and the `tbc-pcom/v1/status` endpoint to render a native profile-completion screen before the user sees the feed.

= What counts as a "real avatar"? =

Any avatar the user has uploaded or selected themselves. Fluent Community's auto-generated placeholder avatars (initials on a colored background) are not counted as complete.

= What happens to user profile data if I uninstall? =

By default, nothing is removed on uninstall — the plugin leaves user meta alone as a safety default. If you want a full wipe, enable **Delete data on uninstall** on the admin settings page before deactivating.

== Changelog ==

= 1.0.0 =
* Initial public release
* Profile completion gate with bio and avatar requirements
* Optional Fluent Community onboarding suppression
* Real avatar detection (distinguishes uploads from placeholders)
* REST API: `/status` and `/complete` endpoints
* `X-TBC-Profile-Incomplete` response header for mobile app integration
* Admin settings page with opt-in data removal on uninstall

== Upgrade Notice ==

= 1.0.0 =
Initial release.
