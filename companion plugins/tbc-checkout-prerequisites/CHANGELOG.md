# Changelog

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
