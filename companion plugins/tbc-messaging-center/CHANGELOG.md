# Changelog - TBC Messaging Center

## 3.5.2
- Fix: Settings panel no longer bleeds through under the active tab (CSS specificity tie overrode `.hidden` on the Settings panel, causing "Loading Settings..." to render below every tab)

## 3.5.1
- Fix: Clarified supported media types in upload tooltip (jpg, png, gif only — webp not supported by Twilio)

## 3.5.0
- Replaced tbc-fluent-profiles dependency with FC 2.3.0 native custom_fields for phone lookup
- Added "Fluent Community Integration" settings section with configurable Phone Field and SMS Opt-In Field dropdowns (populated from FC native custom field definitions)
- Phone-to-user reverse lookup now queries `fcom_xprofile.custom_fields` JSON via `JSON_EXTRACT` (same pattern as tbc-otp)
- NOTXT opt-out now writes directly to FC native custom_fields instead of old usermeta
- Backwards-compatible: falls back to `_tbc_fp_phone` usermeta if FC lookup fails

## 3.4.0
- Added "All Users of a Space" contact list type for messaging Fluent Community space members
- Spaces panel includes real-time search/filter input for quickly finding spaces
- Each space shows member count and expands to show members with phone numbers
- SMS Opt-In checkbox filter to exclude opted-out users from the member list
- Members shown with checkboxes and opt-out strikethrough (same pattern as other contact types)
- Fixed select-all checkbox not working in "All Users of a Product" mode (was scoped only to date-customers container)

## 3.3.2
- Fixed NOTXT opt-out: now updates the profile meta field (`_tbc_fp_{sms_optin_field}`) to "No" in addition to swapping the role, so profile stays in sync and role won't revert on next profile save

## 3.3.1
- Injected Fluent Community CSS variables (`--fcom-*`) via `Utility::getColorCssVariables()` so theme tokens resolve on non-Fluent pages (same fix as tbc-participant-frontend)
- Fixes transparent backgrounds, missing colors, and broken dark mode on the messaging center shortcode page

## 3.3.0
- Fixed transparent form sections in reply panel — added solid backgrounds using `--fcom-primary-bg`
- Increased overlay opacity from 0.3 to 0.5 for better modal visibility
- Added scoped semantic color system (`--tbc-success`, `--tbc-danger`, `--tbc-warning`, `--tbc-info`, `--tbc-purple`, `--tbc-neutral`) with semi-transparent badge backgrounds that adapt to both light and dark themes
- Replaced ~30 hardcoded hex colors across all CSS files with Fluent CSS variables
- Restyled Check All button to use theme variables instead of hardcoded gradient
- Fixed textarea border and background colors for dark mode readability
- Replaced hardcoded button hover colors with `filter: brightness()` for theme-agnostic hover states
- Fixed focus outlines to use theme-aware colors

## 3.2.0
- Migrated all BuddyBoss integration to Fluent Community
- Avatar fetching now uses Fluent Community XProfile model with WordPress fallback
- Profile URLs now link to Fluent Community profiles (`/u/{username}`)
- Phone number retrieval uses tbc-fluent-profiles user meta instead of BuddyBoss xprofile fields
- Reverse phone lookup queries `wp_usermeta` instead of `bp_xprofile_*` tables
- Replaced BuddyBoss notification system (`BP_Core_Notification_Abstract`) with standalone `TBC_MC_Notification` class using `wp_mail()`
- Added `tbc_mc_new_message` action hook for external push notification integration
- Removed BuddyBoss group tabs (Send SMS, Initiate Call) and group settings — no longer applicable
- Replaced BuddyBoss `bp-feedback` CSS classes with own `.tbc-mc-feedback` styles using Fluent CSS variables
- Removed legacy `xprofile_set_field_data()` opt-out write (role-based opt-out is source of truth)

## 3.1.1
- Replaced hardcoded colors with Fluent Community CSS custom properties (`--fcom-*`) for light/dark mode support across all CSS files: message-center.css, sms-center.css, sms-template.css, scheduler.css

## 3.1.0
- Added Settings tab for managing Twilio credentials from the UI
- Removed hardcoded Twilio secrets from source code
- Twilio SID, Auth Token, Messaging Service SID, and Phone Number now stored in wp_options
- Settings tab only visible to administrators

## 3.0.063
- Previous release
