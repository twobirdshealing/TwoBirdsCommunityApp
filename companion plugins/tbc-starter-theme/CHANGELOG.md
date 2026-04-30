# Changelog

All notable changes to the Fluent Starter theme.

## 1.0.2 — Maintenance

- Fix `[fluent_blog]` shortcode pagination rendering as full-width vertically-stacked bars — wrap `paginate_links()` output in `<div class="nav-links">` to match WP's standard pagination markup, so the existing `.fs-pagination .nav-links` flex container styles take effect

## 1.0.1 — Maintenance

- Fix Gutenberg "Hide page title" sidebar registration on WP 6.5+ where `wp.editor.PluginDocumentSettingPanel` was removed — prefer `wp.editPost.PluginDocumentSettingPanel` and drop the `wp.editor` capability gate
- Refactor the sidebar's `useSelect` to return a primitive boolean instead of the whole `meta` object, avoiding panel re-renders on unrelated meta edits
- Tighten `_tbc_hide_title` post-meta `auth_callback` to per-post `current_user_can('edit_post', $post_id)` (canonical signature, drops the over-permissive `edit_pages` capability check)
- Scope the Fluent Community CSS variable bridge to `body` / `html.dark body` (instead of `:root` / `html.dark`) so theme defaults in `base.css` are no longer shadowed by the compat layer
- Add `fluent_starter_asset_ver()` helper and route every `wp_enqueue_*` call through it — single source of truth for the `filemtime()` cache-busting fallback

## 1.0.0 — Initial release

- Blank-canvas WordPress theme purpose-built for Fluent Community — gets out of the way on portal SPA pages, minimal styling elsewhere
- Universal portal frame wrapping: all frontend templates (singular, archive, search, 404, CPTs) auto-render inside the Fluent Community portal frame, gated by a Customizer toggle
- `fluent_community/template_slug` filter widened to wrap everything by default (skips admin, feed, embed, AJAX, cron, and pages with explicit non-frame templates)
- Dark/light mode sync with Fluent Community via `fcom_global_storage` localStorage + inline head script to prevent flash-of-wrong-theme
- CSS variable bridge (`fluent-compat.css`) mapping `--fcom-*` tokens for consistent theming
- Customizer section "Portal Frame Integration" with enable/disable toggle
- Blog integration: `[fluent_blog]` shortcode + Gutenberg block (`fluent-starter/blog-grid`), hero featured post + card grid, single post hero with gradient overlay, author bio box, share buttons, post navigation, reading time, pagination
- Comments section styled to match Fluent Community native layout (`.each_comment`, `.comment_wrap`) with dark mode support
- Fluent Community avatar integration: `get_avatar_url` filter replaces Gravatar with FC XProfile avatars (with recursion guard)
- Profile badge + verified checkmark rendering on blog cards, single posts, author bios, and comments — shared profile cache (single DB lookup per user)
- FluentCart single product + taxonomy archive rendering inside the portal frame via FC's own action hooks; auto `the_content` injection disabled to prevent double-render
- Docs viewer: serve static HTML docs from `wp-content/tbc-docs/` inside the Fluent Community frame at `/docs/{filename}` with auto dark mode and sidebar/header integration
- Maintenance mode: Customizer toggle, admin bar indicator, allows wp-login/wp-admin/REST/Customizer through, dark mode aware
- Auth page banner theme sync — login/signup panels follow FC light/dark mode via CSS variables
- `filemtime()`-based asset cache busting on all `wp_enqueue_*` calls so editing CSS/JS invalidates browser caches without a version bump
- Early-bail if Fluent Community plugin is not active, avoiding dozens of no-op hook registrations and preventing memory-exhaustion crashes on bare sites
