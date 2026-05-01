# Changelog

All notable changes to the TBC Community App white-label product.

## 3.6.0 — 2026-04-30

Big web-parity release: full Fluent Messaging 2.4.0 native compat (groups + community-space chats), space sidebar widgets, document upload in the post composer, and a TanStack Query rollout across high-traffic screens.

### Messaging — Fluent Messaging 2.4.0 native compat

- Group threads — 8 typed endpoints (`createGroup`, `updateGroup`, `deleteGroup`, `leaveGroup`, members CRUD, `setGroupAdmin`); new screens at `/messages/group/[threadId]` with `GroupInfoSheet`, `EditGroupSheet`, `AddMembersSheet`, `NewGroupSheet`.
- Community-space chats — `services/api/spaceThreads.ts` (members, join, leave); new screen at `/messages/space/[threadId]` with `SpaceInfoSheet` (paginated members, View Community, Leave/Rejoin).
- Sectioned inbox — three collapsible sections (Communities / Groups / DMs) with debounced server-side search via `/chat/threads?search=`; renders `left_community_threads` as a faded variant under Communities.
- Real-time — 7 new group lifecycle events (`new_thread`, `thread_updated`, `group_member_added`, `group_member_removed`, `group_admin_changed`, `group_deleted`, `group_removed_from`) on the user channel; community-space chats subscribe to `private-chat_space_{spaceId}` channels driven by the inbox.
- Polling fallback (8s) when Pusher is disconnected, with a no-op guard so `setMessages` doesn't fire when nothing is new.
- System messages render as centered dividers (`meta.system_event`).
- Companion plugin (`tbc-community-app`) — push hook now reads `fcom_chat_threads.provider` so group messages deep-link to `/messages/group/{thread_id}` instead of the legacy DM route. DMs and older app versions are untouched.

### Composer — document upload (FC Pro web parity)

- Paperclip "Upload Documents" action in the post composer; visibility gated on `space.permissions.can_upload_documents` (computed by FC's `FeedsHelper`).
- Documents are a separate `content_type: 'document'` with files in `meta.document_lists`. Mutually exclusive with images / video / GIF / poll — the toolbar hides the other media buttons whenever documents are attached, and vice versa.
- Multiple documents per post via `expo-document-picker`; uploads through FC Pro's `POST /documents/upload` (multipart `space_id` + `file`) using the existing JWT — no companion-plugin proxy.
- New `DocumentPreview` component reuses `iconForMime` from the shared `utils/mime.ts` (also used by `SpaceDocumentsSheet`).
- `expo-document-picker` is a native module — requires a new EAS dev client build, not OTA-safe.

### Spaces — sidebar widgets + pin-to-sidebar

- Gear-menu (kebab) actions on each space, all backed by existing FC endpoints — no new server work:
  - **Documents** when `permissions.can_view_documents` is true (FC Pro)
  - **Chat** when `chat_thread_id` is set and `settings.group_chat_support === 'yes'`; routes to `/messages/space/{chat_thread_id}`
  - **Featured Posts** — pinned posts (`priority === 1`)
  - **Recent Activity** — `feed_published` + `comment_added` events with deep-link to the post (and to the specific comment when present)
- Featured + Activity share one query (stable cache key on `useSpaceActivities`); both lists arrive in a single `/activities?with_pins=1` round-trip.
- Documents sheet tolerates 404/403 so the menu entry quietly no-ops on free-tier sites without FC Pro.
- Post 3-dot menu — admins/mods get **Pin to Sidebar** / **Unpin from Sidebar**, toggling `feed.priority` via `PATCH /feeds/{id}` (mirrors `toggleSticky`). Optimistic update plus `cacheEvents.emit(CACHE_EVENTS.FEEDS)` so the Featured Posts sheet refreshes on next open.

### Data layer — TanStack Query rollout

- Replaced hand-rolled `useState + useEffect + fetch` with TanStack Query (MMKV-persisted) on courses, directory, profile/edit, create-post (edit mode), and CommentSheet so screens render instantly from cache on re-entry while revalidating in the background.
- `useInfiniteQuery` powers pagination + search debounce + pull-to-refresh on courses and directory.
- CommentSheet — optimistic edit/delete/reaction mutations with snapshot rollback on error; refresh for submit/pin where the server is authoritative; clears the sticky slot when the pinned comment is deleted.
- Directory — short-circuits the follow-state merge effect when nothing differs, so `followMap` identity stops churning on every refetch.
- Fixes a swallowed-error bug in create-post (edit mode) that could leave the spinner stuck on a network failure.
- New `hooks/useDebounce.ts` shared by courses + directory search inputs.

### Architecture

- Single typed Pusher event registry — `PusherEventMap` interface, `subscribe<K>(event, handler)`, `bindEvents(channel, names)`. Handler Sets, bind blocks, and registrar functions collapsed from 9 mechanical repetitions into one factory; named `onX` / `useXListener` wrappers stay one-liners.
- `useChatMessages` accepts a discriminated union (`UserChatParams | GroupChatParams | SpaceChatParams`) — TS narrows once at the top of the hook, no runtime warnings.
- `ChatScreenLayout` — single shared scaffold (FlashList, ChatInput, KeyboardAvoidingView, message menu, MediaViewer, ChatReactionPicker, PageHeader) used by all three chat detail screens.
- `MultiSelectUserPicker`, `ThreadSection`, `GroupHeader`, `SystemMessage` — small focused primitives extracted from the inbox + group flows.
- `MemberCard` grew a `nameSuffix` prop so info sheets flag `(You)` without mutating `display_name`.

### Fixes

- Group + space chat sends — `handleSend` was bailing early on `!targetUserId`, but group/space threads intentionally have no `targetUserId`. Gated the early return on "no thread AND no targetUserId" so threads loaded by ID fall through to `sendMessage`.

### Build

- Requires a new EAS dev build (adds `expo-document-picker` native module). All other changes are JS — OTA-safe within an existing 3.6.0 native shell.
