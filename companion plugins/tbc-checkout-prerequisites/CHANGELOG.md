# Changelog

## 3.7.31
- Step bar: current step circle now has a rotating arc ring around it so "in progress" reads distinctly from "completed" at a glance. Reuses the existing `tbc-cp-spin` keyframe — pure CSS, no JS.

## 3.7.30
- Phone screening message: calendar link is now a prominent visually-separated block with emoji callout, clear "tap to save" instruction, and explicit mention of the 1-hour automatic reminder (the ICS file already ships a 1h `VALARM`)
- Phone screening scheduler is now timezone-aware (single-timezone model — uses WP site timezone, e.g. `America/Chicago` for Two Birds)
  - Schedule modal shows a hint under the Date & Time field: *"All times in Central Time (CST). Current time: Apr 20, 10:15 AM CST."* so admins in other states know they're entering church-local time
  - Schedule badges (upcoming, overdue, was) and the Upcoming Calls banner all append the tz abbreviation — e.g. `Apr 21, 8:00 AM CST`
  - Outgoing FluentChat message now reads: `Your phone consultation has been scheduled for Monday, April 21, 2026 at 8:00 AM CST (Central Time).`
  - DST is handled automatically — CST in winter, CDT in summer, based on the actual scheduled date
- Fixed: scheduled times were being parsed as UTC by `strtotime()` and then re-shifted by `date_i18n()`, causing the displayed time to be off by the WP timezone offset (e.g. admin enters 8 AM, message would show 2 AM or 3 AM). Now uses `new DateTime($value, wp_timezone())` + `wp_date()` so the wall-clock value the admin types is the wall-clock value everyone sees.
- New helpers in `tbc-checkout-prerequisites.php`: `tbc_cp_parse_schedule_ts()`, `tbc_cp_tz_abbr()`, `tbc_cp_tz_long_name()`

## 3.7.29
- Entry Review: approving/disapproving an entry now also marks it read in Gravity Forms (flips the native `is_read` flag via `GFFormsModel::update_entry_property`), so reviewed entries no longer show as bold/unread in the GF entries list

## 3.7.28
- Fix GF form broken after AJAX step navigation — use full page navigation for form steps since Gravity Forms JS (`gform` global) is only available when GF enqueues scripts on initial page load, not via AJAX
- Add `tbc-cp-form-step` class to form step indicators for JS detection

## 3.7.25
- Fix fatal error when `current_step` is out of bounds (e.g. invalid `?step=` query param) — clamp to valid range to prevent null being passed to `is_step_submitted()`

## 3.6.0
- Add automated approval/disapproval messaging via FluentChat DMs
- Gear icon (⚙) on Entry Review header opens Message Settings modal
- Configurable message templates with merge tags: `{first_name}`, `{name}`, `{email}`, `{form_name}`, `{consult_notes}`, `{meeting_info}`, `{entry_id}`, `{date_submitted}`
- Separate templates for approved and disapproved messages
- Approval/disapproval now shows a message preview popup with Confirm & Send / Cancel
- `{meeting_info}` auto-populates Zoom details and calendar link when a screening date is set
- Warnings shown if messaging is disabled or no sender is configured
- Removed "Copy scheduling message" clipboard button (edit and calendar buttons remain)
- Fixed modals closing when clicking outside — now only X button and Cancel close modals
- New file: `class-tbc-cp-messaging.php` — handles settings storage, merge tag replacement, and FluentChat sending

## 3.0.8
- Fix button styling being overridden by Fluent Community's `.fluent_com button` reset — added `.tbc-cp-checkout` parent selector for higher specificity

## 3.0.7
- Match course buttons exactly to native Fluent `fcom_primary_button` style: `border-radius: 8px`, `1px solid` border matching background

## 3.0.6
- Simplify Mark Complete and Return to Course buttons to match native Fluent Community button style
- Removed gradients, large shadows, min-width, and circular icon backgrounds
- Buttons now use `--fcom-primary-button` / `--fcom-primary-button-text` with simple hover opacity

## 3.0.5
- Restyle course section headers as subtle uppercase labels (smaller, no background, bottom border only) so they're clearly distinct from clickable lesson items
- Rename "New Member Screening" heading to "New Member Check-In" on the phone screening card

## 3.0.4
- Theme `.tbc-cp-last-updated` pill and `.tbc-cp-form-update-required` banner with `--fcom-*` variables
- Replaced hardcoded orange colors with `--fcom-secondary-text`, `--fcom-active-bg`, `--fcom-primary-border`

## 3.0.3
- Theme pending state cards (approval, phone screening, pharmacist) with `--fcom-*` CSS variables for dark mode support
- Replaced hardcoded light-mode gradients and text colors with `--fcom-secondary-bg`, `--fcom-primary-border`, `--fcom-primary-text`
- Pharmacist booking link now uses `--fcom-text-link` instead of hardcoded teal

## 3.0.2
- Unified all incomplete-type status badges (phone screening, pharmacist consult, awaiting review) to match "Step Incomplete" style with `--fcom-text-off` color for better contrast and consistency
- Keep distinctive icons (phone, medical, hourglass) on each badge for visual differentiation
- Shortened badge text: "New Member Screening" → "New Member", "Pharmacist Consult Required" → "Pharmacist Consult"
- Added `min-height` + flex centering on step indicator titles for consistent vertical alignment

## 3.0.1
- Theme entire plugin with Fluent Community `--fcom-*` CSS variables for light/dark mode support
- Updated navigation, forms, and courses CSS to use Fluent Community color tokens
- Removed hardcoded `--tbc-cp-primary/text/border` custom properties in favor of `--fcom-*` equivalents

## 3.0.0
- **BREAKING**: Replaced LearnDash course integration with Fluent Community courses
- Course prerequisites now use Fluent Community's course system (fcom_spaces / fcom_posts)
- Admin dropdown lists Fluent Community courses instead of LearnDash courses
- Course content displays Sections > Lessons hierarchy (no topics)
- Auto-enroll users in prerequisite courses when they encounter the step
- Mark complete uses Fluent Community's reaction-based completion system
- Course completion triggers Fluent Community's course_completed activity
- Removed all LearnDash function dependencies
- Renamed CSS wrapper class from `tbc-cp-ld-wrap` to `tbc-cp-course-wrap`
- Added section header styling for course sections
- Simplified AJAX handlers (removed content_type parameter, lessons only)
- **Note**: Existing course step configurations must be re-selected from the new Fluent Community course dropdown

## 2.4.3
- Fix 40-60 second delay on Gravity Form submission by switching from AJAX to non-AJAX mode (eliminates multiple slow admin-ajax.php round-trips)
- Fix null entry warning in `store_form_fields_hash`

## 2.4.2
- Rename "Phone Meeting Required" to "New Member Screening" on form status page and dashboard badge
- Updated screening message copy

## 2.4.1
- Spirit pharmacist gate now takes priority over phone screening gate (shown first)

## 2.4.0
- Add "Require Spirit Pharmacist Consultation" per-step option for form steps
- Spirit pharmacist gate blocks checkout when entry is marked as requiring consultation
- User sees amber card with consultation instructions and Calendly booking link
- Distinct progress badge: "Pharmacist Consult Required" (amber/orange)
- Spirit pharmacist status stored as `tbc_cp_spirit_pharmacist` entry meta (managed by tbc-entry-review plugin)
- "Spirit Pharmacist" meta tag displayed on step items in admin settings

## 2.3.1
- Fix "Mark Complete" button not working after the first lesson completion (debounce flag was never reset on success)

## 2.3.0
- Add "Require Phone Screening Confirmation" per-step option for form steps
- Phone screening gate blocks checkout when entry is marked as requiring screening
- User sees "Phone Screening Required" message (info-blue card) distinct from generic "Awaiting Review"
- Distinct progress badges: "Phone Screening Required" (blue), "Awaiting Review" (yellow)
- Phone screening status stored as `tbc_cp_phone_screening` entry meta (managed by tbc-entry-review plugin)
- "Phone Screening" meta tag displayed on step items in admin settings

## 2.2.0
- Add per-step "Require re-submission when questions change" toggle for form steps
- When enabled, users must re-submit if questions are added or removed from the Gravity Form
- Form structure hash (`tbc_cp_fields_hash`) stored as entry meta on submission
- Hash compared against current form fields during completion checks
- Informational "form updated" banner shown when re-submission is required
- "Tracks Changes" meta tag displayed on step items in admin

## 2.1.3
- Fix new Gravity Forms AJAX submissions not redirecting after success card
- Use jQuery `ajaxComplete` instead of GF-specific event for cross-version reliability
- Consolidate duplicate CSS keyframe animation
- Fix mobile horizontal overflow on course topic lists
- Add debounce guard on mark-complete button to prevent duplicate requests

## 2.1.2
- Replace MutationObserver with native Gravity Forms `gform_confirmation_loaded` event for success card redirects

## 2.1.1
- Fix GravityView edit redirect spinner stuck after clicking Update
- Use data-attribute based redirect instead of inline script tags

## 2.1.0
- Add per-step GravityView approval status gating for form steps
- Admin setting to require specific approval statuses (Approved/Disapproved/Unapproved) before a step counts as complete
- "Submitted — Awaiting Review" state with GravityView display for pending entries
- Expired entries bypass approval gating to allow re-submission

## 2.0.1
- Fix XSS vulnerability in admin step list HTML generation
- Add user login check to AJAX handler
- Fix GravityView shortcode sanitization to preserve valid shortcodes
- Cache steps option, cart categories, and step completion status per request
- Extract shared `escHtml()` and `showNotice()` utilities to `tbc-cp-utils.js`
- Replace `alert()` calls with WordPress admin notices
- Fix version mismatch between plugin header and constant
