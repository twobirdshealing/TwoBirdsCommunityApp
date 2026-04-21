# Changelog

## 1.0.0 — 2026-04-15

Initial release.

### 2026-04-21 (post-release fix, no version bump — filemtime cache-busts)

- **Fix:** defensively clear upstream REST `rest_authentication_errors` when our JWT already validated the request. Previously our filter ran at priority 99 and blindly passed any earlier error through, so a plugin that globally hijacked Bearer auth could fail our login on sites where everything else was fine. Our filter now runs at priority 1000 and drops upstream errors when `$jwt_validated === true`.
- **Why this matters:** Uncanny Automator 7.1.0+ ships an MCP `Rest_Bearer_Authenticator` that unconditionally hooks `rest_authentication_errors` and returns `rest_forbidden` / "Invalid or expired Bearer token." for any Bearer token it didn't mint itself — even on sites that aren't using MCP. That broke app login on 2026-04-21 when Automator auto-updated. The fix here asserts our contract cleanly: if our JWT validates, our identity verdict wins. No Uncanny-specific class sniffing or `remove_filter` surgery.
- **Scope:** one file — [includes/class-auth.php](includes/class-auth.php). Adds a `$jwt_validated` flag set on the success path of `validate_token()`, raises `rest_authentication_errors` priority 99 → 1000, and rewrites the callback to drop upstream errors when the flag is set.
