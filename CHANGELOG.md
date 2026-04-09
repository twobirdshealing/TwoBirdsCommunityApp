# Changelog

All notable changes to the TBC Community App white-label product.

## [Unreleased]

### Fixed
- Dashboard build buttons no longer fail silently — `/api/builds/new` now awaits the EAS result and surfaces failures (credentials missing, EAS login expired, network errors, etc.) instead of always reporting "queued" ([setup/dashboard.js](setup/dashboard.js), [setup/lib/eas.js](setup/lib/eas.js))
- Dashboard `eas build` invocations now use `--no-wait` so the request returns after the upload queues on EAS instead of blocking until the entire build completes
- Server-side `eas build` subprocesses are now killed if the dashboard browser disconnects mid-upload, preventing orphaned processes

### Added
- Recent Builds list now shows in-flight build attempts (`submitting` state) and pre-EAS failures (`failed-locally` state) as local entries with the same card layout as EAS rows
- Failed local builds show friendly error text, a "Show details" toggle for raw `eas` output, and a "Dismiss" button
- iOS-credentials build failures show an "Open Config to set up" button that jumps to the new iOS Credentials section in the Config tab
- New informational iOS Credentials row in Config → App Store Submission with the `eas credentials --platform ios` command and a Copy button
- New iOS Simulator build button on the Builds tab (and "iOS Sim" Quick Build chip) for credential-free builds you can run in [Appetize.io](https://appetize.io)
- New "iOS Credentials (first iOS build only)" step-card in [setup/setup-guide.html](setup/setup-guide.html) covering the full interactive walkthrough and the simulator/Appetize escape hatch

### Removed
- `presetProgress` strip and `buildQueuedBanner` from the Builds tab (their job is now done by local entries appearing in the Recent Builds list)

## [3.4.5] — 2026-04-07

### Changed
- Dark mode, messaging, and courses are now fully auto-detected from Fluent Community — manual checkboxes removed from companion plugin settings
- Startup batch conditionally includes messaging and courses paths based on cached feature flags (eliminates 404 spam when modules are off)
- Companion plugin bumped to v3.53.0

### Fixed
- Repeated 404 errors on startup when Course module is disabled in Fluent Community
- Push notification type renamed from `friend_new_post` to `follower_new_post` (companion plugin v3.52.0)
- Push notifications leaking to non-members of private spaces (companion plugin v3.51.2)
- Stale space cache for app-only users added to spaces via automations (companion plugin v3.52.1)
- Stale unread counts caused by LiteSpeed caching authenticated responses (companion plugin v3.52.2)

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
