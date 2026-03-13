# Changelog

## v1.0.1
- Removed `Requires Plugins` header that blocked activation
- Switched to Fluent Community Eloquent models (`Space`, `SpaceUserPivot`, `NotificationSubscription`) instead of raw SQL — matches `tbc-space-manager` pattern
- Uses `Utility::forgetCache()` for proper per-user cache invalidation instead of blunt `wp_cache_flush_group()`
- Batches member processing (500 per batch) to handle large spaces safely
- Moved submit handler from `admin_init` to `load-{$hook}` so it only runs on this page
- Extracted notification type constants and shared level labels to reduce duplication
- Used `wp_kses_post()` for translatable HTML output
- Runtime guard: shows admin notice if Fluent Community is inactive
- Member count query uses `GROUP BY` instead of correlated subquery

## v1.0.0
- Initial release
- Admin page under TBC Community App menu: "Bulk Email Prefs"
- Select a single space or all spaces
- Set notification level: Email Disabled, Admin Posts Only, All Posts
- Applies to all active members of the selected space(s)
- Confirmation dialog before applying
- Space overview table with member counts
