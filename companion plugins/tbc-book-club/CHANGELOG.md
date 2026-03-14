# Changelog

All notable changes to the TBC Book Club Manager plugin.

## v2.3.0
- **REST API**: Moved book club REST endpoints from tbc-community-app into this plugin under `tbc-bc/v1` namespace (GET /books, GET /books/{id}, POST /books/{id}/bookmarks, DELETE /books/{id}/bookmarks/{bookmark_id})
- **Frontend removed**: Stripped all web frontend UI — player, book selector, book info shortcodes, frontend JS/CSS/SVGs. Admin UI unchanged.
- Removed `[tbc_bc_player]` and `[tbc_bc_info]` shortcodes
- Removed Swiper.js and Plyr.js CDN dependencies
- Removed frontend bookmark AJAX handlers (app uses REST API)

## v2.2.0
- Moved admin page under consolidated "TBC Community App" top-level menu
- Falls back to standalone top-level menu if tbc-community-app is not active

## v2.1.0 — 2026-02-26
- Fix: Bookmark formatted_time now shows HH:MM:SS (was truncating hours via gmdate)
- Fix: Removed nopriv AJAX handlers for bookmark save/remove (require login anyway)
- Fix: Synced plugin header version with VERSION constant

## v2.0.008
- Moderator assignment, achievement awarding, user search in admin

## v2.0.0
- Initial release with player, chapters, bookmarks, schedule, meeting info
