=== TBC - Community App ===
Contributors: twobirdscommunity
Tags: mobile-app, rest-api, jwt, push-notifications, fluent-community
Requires at least: 5.8
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.1
License: GPL v2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Support plugin for the TBC Community App. Provides web sessions for WebView, app-specific styling, deep linking, and push notifications.

== Description ==

TBC - Community App is the companion plugin installed on the buyer's WordPress site to power the TBC Community App mobile client. It handles JWT-based authentication, creates web sessions for the in-app WebView, injects app-specific styling into Fluent Community, wires up deep linking, and routes push notifications. Admin settings are managed through the TBC Community App menu.

== Installation ==

1. Upload the `tbc-community-app` folder to `/wp-content/plugins/`.
2. Activate the plugin through the Plugins menu.
3. Go to **TBC Community App** in the admin menu to configure app settings, push notifications, and crash reporting.

== Changelog ==

= 1.0.1 =
* Add: Push log Reason column showing the Expo Push API error code on each failed batch (InvalidCredentials, DeviceNotRegistered, MismatchSenderId, TransportError). Schema migrates automatically on update.
* Add: Realistic failure counts and error codes when Expo is unreachable (DNS, timeout, non-200).
* Update: Features tab Push Notifications description now calls out the FCM v1 service account / APNs key uploads required on Expo, in addition to the Firebase config files.

= 1.0.0 =
* Initial public release
