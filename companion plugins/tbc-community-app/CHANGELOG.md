# Changelog

## 1.0.1 — 2026-05-04

- **Add:** Push log now captures the Expo Push API error code and message on the first failure of each batch. New `Reason` column in WP admin → TBC Community App → Push Log shows the rejection cause inline (e.g. `InvalidCredentials`, `DeviceNotRegistered`, `MismatchSenderId`, `TransportError`). Hover the badge for the full Expo message. Previously every failed batch logged only a count, so admins had no signal about *why* pushes weren't delivering — silent failures with no diagnosis path.
- **Add:** Versioned schema migration. A `tbc_ca_db_version` option is checked on every page load; if it lags the bundled `TBC_CA_DB_VERSION` constant, dbDelta runs to apply pending column additions automatically. Existing installs pick up the new `error_code` / `error_message` columns on the first request after the plugin is updated — no deactivate/reactivate required.
- **Add:** `send_batch()` now reports realistic `sent` / `errors` / `first_error_code` / `first_error_message` on transport-layer failures (DNS, timeout, non-200 from Expo) instead of zeroes. Push log totals now reflect those failures correctly, with `TransportError` / `UnexpectedResponse` codes for diagnosis.
- **Update:** Features tab "Push Notifications" description rewritten to call out the two-part setup — Firebase config files in the app **plus** FCM v1 service account / APNs key uploaded to Expo project credentials. Previous text only mentioned the Firebase configs, which silently let buyers ship apps that could never deliver pushes.
- **Add:** "Test Push to Yourself" card at the top of the Tools tab. Single click sends one push to the admin's most recent device token via the Expo Push API and renders the full response inline — including the Expo error code and a context-specific hint when the credentials aren't configured. Replaces the previous workflow of asking the buyer to run curl on the server.
- **Scope:** four files — [includes/push/class-log.php](includes/push/class-log.php), [includes/push/class-firebase.php](includes/push/class-firebase.php), [includes/push/class-hooks.php](includes/push/class-hooks.php), [includes/admin/class-settings.php](includes/admin/class-settings.php), plus the bootstrap [tbc-community-app.php](tbc-community-app.php).

## 1.0.0 — 2026-04-15

Initial release.

### 2026-05-04 (post-release fix, no version bump — inline CSS, no cache to bust)

- **Fix:** hide the Fluent Community left sidebar in app WebView at all viewport widths. FC's own CSS only hides `.spaces` at `@media (max-width: 1024px)`, so on iPad and larger tablets the sidebar (Feed, Blogs, Courses, channels, Settings) was leaking into the app's WebView. The app provides native bottom-tab navigation at every width, so the sidebar is never wanted in app view.
- **Scope:** one file — [includes/webview/class-app-view.php](includes/webview/class-app-view.php). Adds rules in the inline `<style>` block hiding `.spaces`, `.space_opener`, `.fhr_head`, and zeroing `.feed_layout` `padding-left` so content reclaims the 280px that FC reserved for the sidebar on desktop.

### 2026-04-21 (post-release fix, no version bump — filemtime cache-busts)

- **Fix:** defensively clear upstream REST `rest_authentication_errors` when our JWT already validated the request. Previously our filter ran at priority 99 and blindly passed any earlier error through, so a plugin that globally hijacked Bearer auth could fail our login on sites where everything else was fine. Our filter now runs at priority 1000 and drops upstream errors when `$jwt_validated === true`.
- **Why this matters:** Uncanny Automator 7.1.0+ ships an MCP `Rest_Bearer_Authenticator` that unconditionally hooks `rest_authentication_errors` and returns `rest_forbidden` / "Invalid or expired Bearer token." for any Bearer token it didn't mint itself — even on sites that aren't using MCP. That broke app login on 2026-04-21 when Automator auto-updated. The fix here asserts our contract cleanly: if our JWT validates, our identity verdict wins. No Uncanny-specific class sniffing or `remove_filter` surgery.
- **Scope:** one file — [includes/class-auth.php](includes/class-auth.php). Adds a `$jwt_validated` flag set on the success path of `validate_token()`, raises `rest_authentication_errors` priority 99 → 1000, and rewrites the callback to drop upstream errors when the flag is set.
