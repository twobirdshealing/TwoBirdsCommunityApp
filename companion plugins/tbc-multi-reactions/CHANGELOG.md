# Changelog

All notable changes to the TBC Multi Reactions plugin.

## v1.5.5
- Added "Delete data on uninstall" setting — uninstall no longer deletes reaction data by default, preventing accidental data loss during troubleshooting or reinstalls
- Moved column removal logic into `Database::remove_reaction_type_column()` (single source of truth)
- Removed unused `create_table()` method from Database class

## v1.5.4
- Removed destructive `nullify_reaction_type()` method — disabling a reaction type now safely hides it without losing data, and re-enabling brings all old reactions back instantly

## v1.5.3
- Fixed comment reaction padding — target `.reply_box` parent via `:has()` for actual breathing room in reply row

## v1.5.2
- Added padding to comment react button container for breathing room in reply row

## v1.5.1
- Added padding and border-radius to comment reaction icons

## v1.5.0
- Removed unused batch breakdown REST endpoint (`POST /breakdown/batch`) — no consumers
- Plugin is fully independent — only requires Fluent Community, no dependency on tbc-community-app

## v1.4.1
- Fixed comment reactions visually changing other comments when reacting (position-based ID matching now excludes nested replies)
- Fixed XHR interceptor catching all GET requests instead of only feed/comment API calls
- Fixed double-firing of comment API response handler (removed duplicate load event listener)

## v1.4.0
- Moved admin page under consolidated "TBC Community App" top-level menu
- Falls back to Settings submenu if tbc-community-app is not active

## v1.3.0
- Aligned default reactions with Fluent Messaging 2.2.0 emojis (heart, thumbsup, laugh, wow, cry, party)
- Fixed 6 locked reaction types (no add/delete), sync chat emojis via filter hook
- Replace emoji text with custom icons in web chat reaction badges

## v1.2.2
- Fixed react_removed hook for FluentCommunity 2.2.01 (passes $feed, not $reaction)

## v1.2.1
- Added is_verified and badge_slugs to breakdown/users API response

## v1.2.0
- Initial release with multi-reaction system
