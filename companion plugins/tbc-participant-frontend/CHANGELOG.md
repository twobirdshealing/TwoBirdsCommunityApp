# Changelog

## 4.3.0 - Settings Tab (Event Categories)
- **New:** Admin-only **⚙️ Settings** tab on the participant list page for choosing which WooCommerce product categories feed the event list
- **Removed:** Hardcoded product ID allowlist (`[35059, 34696, 34698]`) — products are now pulled by product category via `tax_query` so any product in one of the selected categories shows up automatically
- New option: `tbc_pf_event_category_ids` (array of term IDs)
- New helpers: `tbc_pf_get_event_category_ids()`, `tbc_pf_get_product_ids_by_categories()`
- New AJAX action: `tbc_pf_save_event_settings` (admin-only, nonce-protected)
- Settings form uses Select2 for the multi-select category picker (already enqueued on the page)
- Shows a clear "No event categories configured" message with a pointer to the Settings tab on first load
- **Migration:** After updating, go to the Settings tab and choose your event categories (e.g. "Sapo", "Ceremony") — the old hardcoded product IDs will no longer drive the list

## 4.2.0 - Markdown Editor (EasyMDE)
- **BREAKING:** Replaced TinyMCE (HTML) editor with EasyMDE markdown editor for post templates
- Templates now store markdown directly — no HTML→markdown conversion needed
- Removed `tbc_pf_html_to_markdown()` function (no longer needed)
- EasyMDE toolbar: headings (H1-H3), bold, italic, lists, links, preview, side-by-side, guide
- EasyMDE styled with Fluent Community CSS variables for dark mode support
- **Note:** Existing templates stored as HTML should be re-saved in the new editor with markdown content

## 4.1.2
- Fix: `wp_unslash()` `$_POST` content/titles before saving templates to database — WordPress magic quotes were baking escaped apostrophes (`\'`) into stored content, causing them to persist in Fluent Community posts

## 4.1.1
- Fix: Convert wp_editor HTML to markdown before passing to `createFeed()` — `message` now stores markdown (matching native Fluent format), `message_rendered` auto-generated as HTML
- Fix: `wp_unslash()` content before conversion to prevent double-escaped apostrophes (`\\\'`)
- Posts are now fully editable in Fluent Community's native post editor

## 4.1.0 - Native Fluent Media Support
- Enhancement: Post template images now render as native Fluent Community gallery attachments (not inline HTML)
- WP media library attachments are registered in Fluent's `fcom_media_archive` table with proper `media_key` for native lookup
- Video embeds now support both uploaded videos and external URLs (YouTube, Vimeo) via Fluent's oembed handler

## 4.0.9
- Fix: Cast `user_id` and `space_id` to integer for `FeedsHelper::createFeed()` validation (posts were silently failing)
- Cleanup: Remove verbose debug logging, keep error-only logging on `createFeed` failures

## 4.0.8
- Debug: Add error logging to `createFeed()` calls to diagnose posts not appearing in spaces
- Cleanup: Remove one-time BuddyBoss→Fluent migration endpoint (migration complete)
- Cleanup: Fix stale "BuddyBoss" comment in event notes notification

## 4.0.7
- Fix: Auto-generate now saves space ID to all order line items so Post Management can find scheduled posts immediately
- Fix: Creator added as admin member on auto-generated spaces (matches native Fluent behavior)
- Fix: Fire `fluent_community/space/created` hook after auto-generation
- Fix: Sanitize space title and description
- Cleanup: Remove debug logging from 4.0.6

## 4.0.6
- Enhancement: Auto-generated chat spaces now use the WooCommerce product's featured image as both logo and cover photo

## 4.0.5
- Fix: Auto-generated chat spaces now set `parent_id` to "Ceremony Spaces" menu group (configurable via `tbc_pf_ceremony_space_parent` option, default 112)

## 4.0.4
- Fix: Strip emojis from space slug when auto-generating chat spaces to prevent routing errors in Fluent Community

## 4.0.3
- Fix: Sub-pages (participant details) now render through the shortcode instead of `template_redirect`, so they inherit the Fluent Community Frame template with proper dark mode CSS variables and portal layout

## 4.0.2
- Fix: Inject Fluent Community CSS variables (`getColorCssVariables()`) inline on plugin pages so `--fcom-*` tokens resolve correctly in dark mode instead of falling back to hardcoded light defaults

## 4.0.1 - Fluent Community CSS Theming
- Themed all 7 CSS files with `--fcom-*` CSS variables for light/dark mode support
- Files: `front-end-table.css`, `details-dashboard.css`, `event-date-list.css`, `management-panel.css`, `team-management.css`, `post-management.css`, `post-settings.css`
- Backgrounds, text colors, borders, table headers, tabs, buttons, and accent colors now inherit from Fluent Community color scheme
- Select2 dropdown styling themed with Fluent variables
- Semantic colors preserved as static (success green, danger red, warning yellow, info blue, gender colors)

## 4.0.0 - Fluent Community Migration
- **BREAKING:** Replaced all BuddyBoss group integrations with Fluent Community Spaces
- **BREAKING:** Replaced all LearnDash course integrations with Fluent Community Courses
- Replaced BuddyBoss notification system with wp_mail() email notifications
- Event chat groups now create Fluent Community Spaces (privacy: secret)
- Course enrollment/progress now uses Fluent CourseHelper (IDs configurable via wp_options)
- Profile URLs now link to Fluent Community XProfile pages
- Gender data now reads from tbc-fluent-profiles user meta (_tbc_fp_gender)
- Group membership checks now use Fluent Community's Helper::isUserInSpace()
- Scheduled posts now use FeedsHelper::createFeed() for Fluent Community space feeds
- Added one-time data migration AJAX endpoint (tbc_pf_migrate_group_ids) for updating line item meta
- Removed BuddyBoss dependencies: BP_Core_Notification_Abstract, groups_*, bp_media_*, xprofile_*
- Removed LearnDash dependencies: sfwd_lms_has_access, learndash_user_get_course_progress, learndash_user_set_enrolled_courses

## 3.0.75
- Fixed SMS Contact List not showing guest (non-registered) WooCommerce users
- Guest users now pull phone numbers from WooCommerce billing data instead of BuddyBoss profiles
- Guest entries display with "(Guest)" label in the contact list
- Added phone-based deduplication to prevent duplicate entries

## 3.0.74
- Previous release
