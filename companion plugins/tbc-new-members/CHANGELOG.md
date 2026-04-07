# Changelog

## 3.0.0 — 2026-04-06

Complete rewrite for Fluent Community (migrated from BuddyBoss).

### Breaking Changes
- Removed all BuddyBoss/BuddyPress dependencies (`bp_is_active()`, `bp_activity_*`, `bp_core_*`)
- Removed Welcome Message auto-post tab (was posting to BuddyBoss activity stream)
- Removed Shadow User tracking tab (was using BB hooks for activity tracking)
- Dropped `user_visit_logs` table usage (shadow tracking)
- REST API namespace changed from `bb-monthly/v1` to `tbc-members/v1`

### New Features
- **New Members list with Copy buttons** — select members and copy names or @mentions for pasting into welcome posts elsewhere
- Stats dashboard now queries Fluent Community native tables (`fcom_posts`, `fcom_post_comments`, `fcom_post_reactions`)
- Reactions stat card added to dashboard (queries `fcom_post_reactions` for likes)
- Profile links now point to Fluent Community profiles (`/u/username`)
- Fluent Community theme integration — all CSS uses `--fcom-*` variables for automatic light/dark mode sync

### Removed
- `class-shadow.php` — BuddyBoss shadow user tracking
- `class-welcome.php` — BuddyBoss welcome post creator
- `shadow.css`, `shadow.js` — shadow user UI
- `welcome.css`, `welcome.js` — welcome message UI
- All `bp_is_active()` calls that caused fatal errors after migration

## 2.46

- Last BuddyBoss-based release
- Shadow user tracking with activity logging
- Welcome message auto-post to BuddyBoss activity stream
- Dashboard with BB activity stats
