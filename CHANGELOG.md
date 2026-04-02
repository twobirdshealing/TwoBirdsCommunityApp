# Changelog

All notable changes to the TBC Community App white-label product.

## [3.4.4] — 2026-04-02

### Added
- Unified feature flag system — all app features now gated through `features.*` from the server
- Auto-detected FC module flags: followers, giphy, emoji, badges, custom_fields
- Site Features section in companion plugin admin (Features tab) with ACTIVE/INACTIVE badges
- Dark mode toggle gated by `features.dark_mode` flag
- Follow buttons gated by `features.followers` (directory, members, connections, profile)
- GIF picker gated by `features.giphy` (post composer, comment sheet)

### Fixed
- Dark mode toggle was always visible regardless of admin setting
- Follow buttons showed even when FC Follower module was disabled
- GIF button showed even when FC Giphy module was disabled
- Feature detection now uses FC's native `Helper::isFeatureEnabled()` instead of `class_exists()`

### Changed
- Companion plugin bumped to v3.51.1
- Decoupled multi-reactions module from core (no more 404 on sites without the add-on)
- FeedCard performance optimization — feed-level callbacks, proper React.memo

## [3.3.0] — 2026-03-26

### Added
- OTA updates — expo-updates integration + dashboard tab for pushing JS-only updates
- QR code install modal for internal distribution builds
- MMKV storage + TanStack Query migration for faster data fetching and caching
- Build page validation gates + warning banners in setup dashboard
- Inline copy buttons for wp-admin Deep Linking fields
- Dynamic deep linking settings in setup dashboard
- Staging URL support with dev workflow improvements
- Multi-reactions extracted into module + slot system
- Server-controlled feature flags (wp-admin → Features tab)
- WooCommerce cart extracted into standalone module
- Floating save bar with dirty tracking in dashboard
- Quick Commands toolbar with help toggle

### Fixed
- Chat send failures now show actual error messages
- Space cache rebuilds on JWT login — fixes feed visibility
- useFeatures() returns safe defaults instead of throwing on race condition
- Sticky post handling moved from activity feed to space feed
- Welcome banner image uses 1:1 aspect ratio instead of fixed height
- EXPO_PUBLIC_ env vars for reliable Metro URL resolution

## [3.1.0] — 2026-03-16

### Added
- Complete course LMS — quizzes, oEmbed media, links, instructor, lock screens
- Course completion celebrations and module settings
- License server per-site validation + deactivate endpoint
- White-label update workflow with snapshot versioning
- Server-driven socket config for multi-provider support
- Setup guide with prerequisite cards, EAS dashboard flow, ASC app creation walkthrough
- Bot protection — Turnstile, disposable email blocking, REST API index hiding
- Full documentation suite (theme system, module system, companion plugins, and more)

### Fixed
- Profile-completion gate is persistent — can't skip with back button
- OTP registration flow hardened — require phone slug
- Custom profile fields saved during web registration
- HTML5 input types corrected on web signup form

### Changed
- OTP and profile-completion fully modularized — zero core special treatment
- Setup dashboard lock icons and EAS flow improvements

## [3.0.1] — 2026-03-11

### Added
- Dual-token auth, startup batch API, maintenance/update gates and deep linking
- GIF picker, polls/surveys, optimistic bookmarks and unified error handling
- Incognito webview, HTML welcome banner
- Space lock screen, profile route restructure
- Registration improvements, editor/header consolidation, form field upgrades
- Pusher real-time fixes, space join from cards
- Profile completion gate

### Changed
- Expo SDK 55, React Native 0.83, React 19
- Migrate TouchableOpacity to Pressable/AnimatedPressable
- Comments and composer moved from inline modals to dedicated stack screens

### Fixed
- Maintenance mode login button bypassing auth guard
- Editor bottom sheet compatibility (switched to React Native Modal)
- EAS build compatibility with legacy-peer-deps
