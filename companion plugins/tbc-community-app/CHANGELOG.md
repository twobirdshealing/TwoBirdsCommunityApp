# Changelog

## 1.0.0 — 2026-04-15

Initial release.

### 2026-05-04 (post-release fix, no version bump — inline CSS, no cache to bust)

- **Fix:** hide the Fluent Community left sidebar in app WebView at all viewport widths. FC's own CSS only hides `.spaces` at `@media (max-width: 1024px)`, so on iPad and larger tablets the sidebar (Feed, Blogs, Courses, channels, Settings) was leaking into the app's WebView. The app provides native bottom-tab navigation at every width, so the sidebar is never wanted in app view.
- **Scope:** one file — [includes/webview/class-app-view.php](includes/webview/class-app-view.php). Adds rules in the inline `<style>` block hiding `.spaces`, `.space_opener`, `.fhr_head`, and zeroing `.feed_layout` `padding-left` so content reclaims the 280px that FC reserved for the sidebar on desktop.

### 2026-04-21 (post-release fix, no version bump — filemtime cache-busts)

- **Fix:** defensively clear upstream REST `rest_authentication_errors` when our JWT already validated the request. Previously our filter ran at priority 99 and blindly passed any earlier error through, so a plugin that globally hijacked Bearer auth could fail our login on sites where everything else was fine. Our filter now runs at priority 1000 and drops upstream errors when `$jwt_validated === true`.
- **Why this matters:** Uncanny Automator 7.1.0+ ships an MCP `Rest_Bearer_Authenticator` that unconditionally hooks `rest_authentication_errors` and returns `rest_forbidden` / "Invalid or expired Bearer token." for any Bearer token it didn't mint itself — even on sites that aren't using MCP. That broke app login on 2026-04-21 when Automator auto-updated. The fix here asserts our contract cleanly: if our JWT validates, our identity verdict wins. No Uncanny-specific class sniffing or `remove_filter` surgery.
- **Scope:** one file — [includes/class-auth.php](includes/class-auth.php). Adds a `$jwt_validated` flag set on the success path of `validate_token()`, raises `rest_authentication_errors` priority 99 → 1000, and rewrites the callback to drop upstream errors when the flag is set.
