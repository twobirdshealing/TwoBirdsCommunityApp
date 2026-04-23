=== TBC - License Server ===
Contributors: twobirdscommunity
Tags: fluentcart, licensing, rest-api, updates
Requires at least: 5.8
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL v2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Bridge between the TBC Community App dashboard and FluentCart Pro licensing. Validates licenses and serves core updates.

== Description ==

TBC License Server is a thin bridge plugin that exposes REST endpoints the TBC Community App dashboard uses for license validation and update delivery. FluentCart Pro handles all license management (key generation, subscription sync, customer portal); this plugin only exposes the outward-facing API. Install on the license-issuing WordPress site alongside FluentCart Pro.

== Installation ==

1. Install and activate FluentCart Pro with the Licensing module enabled.
2. Upload the `tbc-license-server` folder to `/wp-content/plugins/`.
3. Activate the plugin through the Plugins menu.

== Changelog ==

= 1.0.0 =
* Initial public release
