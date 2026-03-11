=== TBC Multi Reactions ===
Contributors: twobirdscommunity
Tags: reactions, emoji, fluent-community, multi-reaction, comments
Requires at least: 5.8
Tested up to: 6.9
Requires PHP: 7.4
Stable tag: 1.2.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Multi-reaction system for Fluent Community. Replace the default heart with emoji and custom icon reactions on posts and comments.

== Description ==

TBC Multi Reactions transforms Fluent Community's single-heart reaction into a Facebook-style multi-reaction system. Users can react with Like, Love, Laugh, Wow, Sad, Angry, or any custom reaction types you create — on both posts and comments.

Unlike other reaction plugins, TBC Multi Reactions is purpose-built for Fluent Community and integrates deeply with its theming, media system, and API layer.

= Core Features =

* **Multi-Reaction Picker** — Replaces the default heart with a hover-to-reveal reaction picker (Like, Love, Laugh, Wow, Sad, Angry + unlimited custom types)
* **Post & Comment Reactions** — Full reaction support on both feed posts AND comments, each with independent tracking and display
* **Reaction Swapping** — Users can change their reaction type with a single click, no need to remove and re-add
* **Reaction Breakdown Modal** — Click the reaction summary to see per-reaction counts with tabbed user lists, avatars, and profile links

= Custom Icons & Media =

* **Custom Icon Uploads** — Upload PNG, JPG, SVG, GIF, or WebP icons for any reaction type (2MB max, auto-resized to 128x128)
* **Animated Emoji Support** — Full support for animated GIF and animated WebP icons that play on hover and active states
* **Automatic WebP Conversion** — Static PNG/JPG uploads are automatically converted to WebP for optimal performance
* **Fluent Community Media Integration** — Icons are stored through Fluent Community's media system, maintaining full consistency with FC's file management

= REST API & Mobile App Support =

* **Full REST API** — 5 dedicated endpoints for reaction configuration, swapping, breakdowns, batch queries, and user details
* **API Response Enrichment** — Automatically injects reaction data into Fluent Community's existing API responses for feeds, comments, and activities
* **Mobile App Compatible** — Supports JWT Bearer token authentication alongside cookie-based web auth

= Theming & Display =

* **Fluent Community Theme Integration** — Inherits FC's CSS variables for seamless visual matching
* **Light & Dark Mode** — Automatically follows Fluent Community's theme toggle
* **Color-Coded Reactions** — Configurable accent color per reaction type for active states, summaries, and modal tabs
* **Overlapping Icon Summary** — Facebook-style overlapping reaction icons with total count

= Admin & Configuration =

* **Visual Admin Panel** — Drag-and-drop sortable reaction grid with live preview
* **Reaction Editor** — Per-reaction modal with emoji input, custom icon upload, name, color picker, and enable/disable toggle
* **Unlimited Custom Reactions** — Create reaction types beyond the 6 defaults
* **Clean Uninstall** — Complete data removal on uninstall

= Performance =

* **Batch Database Operations** — Fetches data for multiple items in single queries
* **Transient Caching** — Breakdown caching to minimize database load
* **Conditional Asset Loading** — CSS/JS only loaded when needed
* **Indexed Database Column** — Custom column with proper indexing for fast lookups

== Installation ==

1. Ensure Fluent Community is installed and activated.
2. Upload the `tbc-multi-reactions` folder to `/wp-content/plugins/`.
3. Activate the plugin through the Plugins menu.
4. Go to Settings > TBC Multi Reactions to configure your reaction types.
5. Enable the plugin using the master toggle.

== Frequently Asked Questions ==

= Does this require Fluent Community? =

Yes. TBC Multi Reactions is built specifically for Fluent Community and requires it to be installed and activated.

= Will this work with the Fluent Community mobile app? =

Yes. The plugin enriches Fluent Community's API responses with reaction data and provides dedicated REST endpoints that support JWT Bearer token authentication for mobile apps.

= Can I use animated emoji? =

Yes. Upload animated GIF or animated WebP files as custom reaction icons. They will animate on hover and when active.

= What happens to existing reactions when I install this? =

Existing "like" reactions in Fluent Community are preserved. The plugin adds a new column to track reaction types without modifying FC's original data.

= What happens when I uninstall? =

The plugin performs a complete cleanup: removes settings, the custom database column, uploaded icon files, media records, and cached data. Fluent Community's original reaction data remains intact.

= Can I add more than 6 reaction types? =

Yes. You can add unlimited custom reaction types with custom names, emoji, icons, and colors through the admin panel.

== Screenshots ==

1. Multi-reaction picker on feed posts
2. Reaction breakdown modal with user list
3. Comment reactions with summary display
4. Admin settings panel with drag-and-drop reaction grid
5. Reaction editor modal with emoji and custom icon options

== Changelog ==

= 1.2.0 =
* Inject reaction type data (tbc_reaction_type, icon_url, emoji) into notifications API response
* Uses FC's native notifications_api_response and unread_notifications_api_response filters
* App notification icon now shows the actual reaction icon (custom image or emoji) instead of always a heart

= 1.1.0 =
* Fix: Notification text now reflects the actual reaction type instead of always showing "loved"
* Patches Fluent Community's hardcoded notification verb after creation using the Notification model
* Adds reaction verb mapping (liked, loved, laughed at, reacted to) with fallback for custom types

= 1.0.0 =
* Initial public release
* Multi-reaction picker for posts and comments
* Custom icon uploads (PNG, JPG, SVG, GIF, WebP)
* Animated emoji support (GIF, animated WebP)
* Automatic WebP conversion
* Full REST API with 5 endpoints
* API response enrichment for mobile app compatibility
* Light and dark mode support
* Fluent Community theme integration
* Drag-and-drop admin panel
* Reaction breakdown modal with user lists
* Transient caching and batch database operations
* Clean uninstall handler

== Upgrade Notice ==

= 1.2.0 =
Notification icons now show the actual reaction type (custom icon or emoji) instead of always a heart.

= 1.1.0 =
Notification text now correctly shows the reaction type (e.g. "liked", "laughed at") instead of always "loved".

= 1.0.0 =
Initial release.
