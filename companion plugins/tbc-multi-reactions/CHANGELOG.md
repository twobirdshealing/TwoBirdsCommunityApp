# Changelog

All notable changes to the TBC Multi Reactions plugin.

## v1.0.0 — Initial release

- Multi-reaction picker on Fluent Community posts and comments (6 fixed reaction types by default: heart, thumbsup, laugh, wow, cry, party)
- Custom reaction icon uploads: PNG, JPG, SVG, GIF, WebP — 2MB max, auto-resized to 128x128, animated GIF/WebP supported
- Automatic WebP conversion for static PNG/JPG uploads
- Full REST API under `tbc-multi-reactions/v1` (`/config`, `/swap`, `/breakdown/{type}/{id}`, `/breakdown/{type}/{id}/users`)
- API response enrichment for Fluent Community feeds, single feed, comments, reactions, notifications, unread notifications, and activities
- Reaction breakdown modal with tabbed per-reaction user lists, avatars, verified badges, and profile links
- Fluent Community theme integration with light/dark mode and per-reaction accent colors
- Drag-and-drop admin grid with per-reaction editor (emoji, custom icon, name, color, enable toggle)
- Fluent Messaging chat emoji sync via `fluent_messaging/allowed_reaction_emojis` filter
- Notification text patched to use the actual reaction verb instead of hardcoded "loved"
- Transient caching for breakdown queries and batched DB lookups for feed/comment lists
- Indexed `tbc_mr_reaction_type` column added to `fcom_post_reactions` on activation
- Optional "Delete data on uninstall" setting — off by default
- Mobile app compatibility via JWT Bearer authentication
