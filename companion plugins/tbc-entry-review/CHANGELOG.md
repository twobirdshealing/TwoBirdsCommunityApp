# Changelog

## 1.7.6
- Added consult notes support for Kambo Readiness Form (form 16, field 119)
- Consult notes now use a form-to-field map instead of hardcoded form ID 1 / field 18
- Kambo entries require consult notes before approval (same as Ceremony)
- Field 119 marked as admin-only in entry view and excluded from clipboard copy

## 1.7.5
- Consultation notes column now only shows for Ceremony Readiness Form (form ID 1)
- Other forms (e.g. Liability Waiver) show "N/A" for notes and no longer require notes for approval
- Server-side approval validation also skips notes check for non-Ceremony forms

## 1.7.2
- Replace "Scheduled" text with phone icon (📞) in schedule badge to save space

## 1.7.0
- Phone screening scheduling: "Schedule Call" button with datetime picker and optional note when screening is required
- Scheduling data stored as `tbc_cp_phone_screening_date` and `tbc_cp_phone_screening_note` entry meta
- Scheduled date shown as badge in Phone Screening column (blue=scheduled, red=overdue, grey=completed history)
- Tab counts: each filter tab now shows entry count (e.g. "Pending Review (3)")
- New "Upcoming Calls" tab showing entries with scheduled phone screenings, sorted by date
- Alert banner for upcoming/overdue phone screenings (next 48 hours) visible across all tabs

## 1.6.2
- Fix approval changes not triggering GravityView hooks (Uncanny Automator automations now fire correctly)

## 1.6.1
- Add "Pharmacist Required" quick filter tab to entry review page

## 1.6.0
- Replace approval buttons with color-coded dropdown (green=Approved, yellow=Unapproved, red=Disapproved)
- All three approval states always available in dropdown (no need to disapprove before unapproving)
- Color-coded Spirit Pharmacist and Phone Screening dropdowns (green on Completed, yellow on Required)
- Allowed button now green (matching Blocked=red color scheme)
- Actions column simplified to View and Copy only
- Confirmation prompt before changing approval status with revert on cancel

## 1.5.1
- Spirit Pharmacist column now appears before Phone Screening in the table (matches priority order)

## 1.5.0
- "Spirit Pharmacist" column with dropdown — set status (Not set / Not required / Required / Completed)
- Spirit pharmacist status stored as `tbc_cp_spirit_pharmacist` entry meta
- Safety gate: approval blocked until spirit pharmacist status is set (when enabled for the step)
- Spirit pharmacist filter dropdown added to filter bar
- Server-side validation enforces spirit pharmacist status before approval changes

## 1.4.0
- Pagination: 20 entries per page with WP-style page links and "Showing X–Y of Z" count
- Filter bar with search (user name/email), medications (yes/no), blocked status, approval status, and phone screening dropdowns
- Filters persist across pages and work with all tabs (Pending, Phone Screening, All Entries)
- "Clear Filters" link to reset all active filters
- Tab links now reset filters for clean navigation

## 1.3.0
- "Blocked" column with toggle button — shows if user has `church_user` role (shadow ban)
- Click to block (adds `church_user` role) or unblock (removes it) with confirmation
- Uses `add_role()` / `remove_role()` to preserve all other user roles
- Red button when blocked, gray when allowed

## 1.2.0
- "Copy" button in actions column — copies all form field data to clipboard as clean plain text for pasting into assessment tools
- Consultation notes (field 18) excluded from copied data (admin-internal)
- Fixed consultation notes losing line breaks when loaded into modal (hidden textarea instead of data attribute)
- Fixed missing entries: increased query page size from default 20 to 999
- Fixed entries with no prior approval status (status 0) not appearing in Pending Review filter

## 1.1.0
- Consult notes button now shows green when notes have content (removed text preview)
- Stricter safety gate: ALL approval actions (approve, disapprove, unapprove) now require both phone screening set AND consultation notes before becoming available
- Server-side validation enforces both conditions for all approval status changes
- Approval buttons show contextual tooltip explaining what's still needed

## 1.0.0
- Initial release
- Admin page under WooCommerce > Entry Review for reviewing Gravity Forms entries
- Filter tabs: Pending Review, Phone Screening Required, All Entries
- View full form entry fields in modal (copy-friendly for assessment programs)
- Edit consultation notes (GF field 18) used by Uncanny Automator for approval messages
- Phone screening status management (Not set / Not required / Required / Completed)
- Approve / Disapprove / Unapprove entries directly from the review page
- Safety gate: approval blocked until phone screening status is resolved (when enabled)
- Reads form step configuration from tbc-checkout-prerequisites plugin
- Stores phone screening status as `tbc_cp_phone_screening` entry meta
