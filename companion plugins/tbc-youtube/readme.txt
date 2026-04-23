=== TBC - YouTube ===
Contributors: twobirdscommunity
Tags: youtube, rest-api, video, mobile-app
Requires at least: 5.8
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPL v2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

YouTube channel integration for the TBC Community App. Provides REST API endpoints for fetching channel videos and playlists via YouTube Data API v3 with server-side caching.

== Description ==

TBC YouTube exposes a thin REST wrapper around the YouTube Data API v3 for the TBC Community App mobile client. Server-side caching (via WP transients) keeps YouTube API quota usage low while the app displays the latest channel videos and playlists. Configure your YouTube API key and channel ID from the admin settings page.

== Installation ==

1. Obtain a YouTube Data API v3 key from Google Cloud Console.
2. Upload the `tbc-youtube` folder to `/wp-content/plugins/`.
3. Activate the plugin through the Plugins menu.
4. Enter the API key and channel ID from the admin settings page.

== Changelog ==

= 1.0.0 =
* Initial public release
