# Changelog

## 1.5.0 — 2026-03-24
- Added space-level roles (Space Admin, Space Moderator) to all three sections
- Three role tiers: Global Manager Roles, Space-Level Roles, WordPress Roles
- Space roles check `fcom_space_user` table via native `SpaceUserPivot` model
- Matches users who hold the selected role in any space
- Defaults: space admin + moderator always messageable on fresh install

## 1.4.0 — 2026-03-24
- Added Fluent Community roles (Admin, Moderator) to DM and Community Chat restriction sections
- Sender permission checks now evaluate both WP roles and FC roles
- All three sections (Always Messageable, DMs, Community Chats) now have consistent FC + WP role layout
- Either WP or FC role match grants access (OR logic)

## 1.3.0 — 2026-03-24
- Redesigned admin UI: card layout with compact chip-style role selectors
- Added Fluent Community roles (Admin, Moderator) to "Always Messageable" section
- Split always-messageable into WP roles + FC roles sections
- FC roles checked via `getCommunityRoles()` on target user
- Defaults: WP administrator + FC admin/moderator always messageable on fresh install

## 1.2.0 — 2026-03-24
- Replaced "Always Allow Messaging Admins" checkbox with configurable "Always Messageable Roles" section
- Any role can now be set as always-messageable (e.g. admin, team lead, support staff)
- Uses full role selector with all WordPress roles including administrator
- Defaults to administrator on fresh install

## 1.1.0 — 2026-03-24
- Added "Always Allow Messaging Admins" option (enabled by default)
- Any user can DM administrators and FC moderators regardless of role restrictions
- Reads target user from request body (`intent_id`) to check if recipient is admin/mod
- New admin setting with toggle in settings page

## 1.0.0 — 2026-03-24
- Initial release
- Role-based DM initiation restrictions (overrides Fluent Messaging points system)
- Role-based community/space chat restrictions
- Admin settings page under TBC Community App menu (standalone fallback)
- Administrators and FC moderators always bypass restrictions
- Fail-open design: no roles selected = everyone can message
