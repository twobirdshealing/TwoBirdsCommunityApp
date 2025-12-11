# Fluent Community - Reverse Engineered Reference
## Extracted from app.js and app.css

---

## 🔑 KEY DISCOVERY: Reaction API (Undocumented)

The `/feeds/{id}/react` endpoint accepts these parameters:

```javascript
// ADD a reaction
{ react_type: "like" }

// REMOVE a reaction (UNDOCUMENTED!)
{ react_type: "like", remove: true }

// BOOKMARK a post (uses same endpoint!)
{ react_type: "bookmark" }

// REMOVE bookmark
{ react_type: "bookmark", remove: true }
```

**Response:**
```json
{"message": "Reaction has been added", "new_count": 1}
{"message": "Reaction has been removed", "new_count": 0}
```

**Feed object includes:**
- `has_user_react` - boolean, whether current user has reacted
- `reactions_count` - number of reactions
- `bookmarked` - boolean, whether current user bookmarked

---

## 📡 API Endpoints (from app.js)

### Feeds
```
GET  /feeds                           - List feeds
GET  /feeds/{id}/by-id                - Get single feed
GET  /feeds/{slug}/by-slug            - Get feed by slug
POST /feeds                           - Create new feed
POST /feeds/{id}                      - Update feed
DELETE /feeds/{id}                    - Delete feed
POST /feeds/{id}/react                - React/bookmark (see above)
GET  /feeds/{id}/reactions            - Get reactions list
GET  /feeds/bookmarks                 - Get user's bookmarks
GET  /feeds/ticker                    - Get new posts since timestamp
POST /feeds/markdown-preview          - Preview markdown
POST /feeds/media-upload              - Upload media
```

### Comments
```
GET  /feeds/{feed_id}/comments                    - Get comments
POST /feeds/{feed_id}/comments                    - Create comment
POST /feeds/{feed_id}/comments/{id}               - Update comment
DELETE /feeds/{feed_id}/comments/{id}             - Delete comment
POST /feeds/{feed_id}/comments/{id}/reactions     - React to comment
GET  /comments/{id}/reactions                     - Get comment reactions
```

**Comment reaction payload:**
```javascript
{ state: 1 }  // Like
{ state: 0 }  // Unlike
```

### Spaces
```
GET  /spaces                          - List spaces
GET  /spaces/{slug}/by-slug           - Get space details
POST /spaces/{slug}/join              - Join space
POST /spaces/{slug}/leave             - Leave space
GET  /spaces/{slug}/members           - Get space members
POST /spaces/{slug}/members           - Add member (admin)
POST /spaces/{slug}/members/remove    - Remove member
GET  /spaces/discover                 - Discover spaces
GET  /spaces/space_groups             - Get space groups
```

### Profile
```
GET  /profile/{username}              - Get profile
POST /profile/{username}              - Update profile
PUT  /profile/{username}              - Update profile
GET  /profile/{username}/spaces       - User's spaces
GET  /profile/{username}/comments     - User's comments
POST /profile/{username}/follow       - Follow user
POST /profile/{username}/unfollow     - Unfollow user
POST /profile/{username}/block        - Block user
POST /profile/{username}/unblock      - Unblock user
GET  /profile/{username}/followers    - Get followers
GET  /profile/{username}/followings   - Get followings
```

### Notifications
```
GET  /notifications                   - List notifications
GET  /notifications/unread            - Get unread count
POST /notifications/mark-read/{id}    - Mark as read
POST /notifications/mark-all-read     - Mark all read
POST /notifications/mark-read/{feed_id}/by-feed-id - Mark by feed
```

### Activities
```
GET  /activities                      - Activity feed
```

### Members
```
GET  /members                         - List members (with mention search)
```

---

## 🎨 CSS Theme Variables

Fluent Community uses CSS variables for theming:

### Colors
```css
--fcom-primary-bg: #FFFFFF           /* Card backgrounds */
--fcom-secondary-bg: #f0f2f5         /* Page background */
--fcom-active-bg: #f0f2f5            /* Hover/active states */

--fcom-primary-text: #19283a         /* Main text */
--fcom-secondary-text: #697386       /* Secondary text */
--fcom-text-off: #959595             /* Muted text */
--fcom-text-link: #2078f4            /* Links */

--fcom-primary-border: #e4e7eb       /* Card borders */
--fcom-secondary-border: #e5e7eb     /* Dividers */

--fcom-primary-button: #2B2E33       /* Button background */
--fcom-primary-button-text: #FFFFFF  /* Button text */

--fcom-highlight-bg: #fffce3         /* Highlighted items */
--fcom-header-height: 55px           /* Header height */
```

### Key Dimensions
```css
/* Feed cards */
border-radius: 6px
padding: 20px
margin-bottom: 10-20px
box-shadow: 0 0 5px rgba(0,0,0,0.1)

/* Avatars */
fcom_user_avatar - standard avatar component

/* Lists */
fcom_feed_list - feed item in list view
gap: 10px
padding: 15px

/* Typography */
feed_title_heading: 16px
fcom_feed_meta: 0.8rem (timestamps, etc)
```

---

## 🧩 Component Class Names

Main components identified in CSS:

### Feed Related
- `.feed` - Feed card container
- `.feed_header` - Post header (avatar, name, time)
- `.feed_body` - Post content
- `.feed_actions` - Like/comment buttons
- `.feed_user` - User info section
- `.feed_md_content` - Markdown content
- `.fcom_feed_list` - Feed in list view
- `.fcom_feed_data` - Feed data wrapper
- `.fcom_feed_meta` - Timestamp, space name
- `.fcom_feed_topics` - Topic tags
- `.fcom_child_feed` - Nested/shared feed

### Profile Related
- `.fcom_profile_header` - Profile header section
- `.fcom_update_profile` - Edit profile form

### Editor/Composer
- `.fcom_full_editor` - Rich text editor
- `.fcom_text_composer` - Simple text input
- `.fcom_create_status_box` - "What's happening" box
- `.fcom_composer_footer` - Editor footer (buttons)

### Media
- `.fcom_image_carousel` - Image gallery
- `.fcom_image_wrap` - Image container
- `.fcom_media_type_image` - Image post type

### Navigation
- `.fcom_app_render` - Main app container
- `.fcom_single_layout` - Single post layout
- `.fcom_dir_layout` - Directory layout

### Notifications
- `.fcom_notification_card` - Notification item

---

## 💡 Implementation Notes for React Native

### 1. Reaction Toggle Pattern
```typescript
const toggleReact = async (feedId: number, hasUserReact: boolean) => {
  const payload: any = { react_type: 'like' };
  if (hasUserReact) {
    payload.remove = true;
  }
  
  const response = await api.post(`feeds/${feedId}/react`, payload);
  
  // Update local state
  setFeed(prev => ({
    ...prev,
    has_user_react: !hasUserReact,
    reactions_count: response.new_count
  }));
};
```

### 2. Bookmark Toggle (same endpoint!)
```typescript
const toggleBookmark = async (feedId: number, isBookmarked: boolean) => {
  const payload: any = { react_type: 'bookmark' };
  if (isBookmarked) {
    payload.remove = true;
  }
  
  await api.post(`feeds/${feedId}/react`, payload);
};
```

### 3. Comment Reactions
```typescript
// Different from feed reactions!
const toggleCommentLike = async (feedId: number, commentId: number, isLiked: boolean) => {
  await api.post(`feeds/${feedId}/comments/${commentId}/reactions`, {
    state: isLiked ? 0 : 1  // 0 = unlike, 1 = like
  });
};
```

### 4. Feed Object Shape (important fields)
```typescript
interface Feed {
  id: number;
  user_id: number;
  space_id: number | null;
  title: string | null;
  slug: string;
  message: string;
  message_rendered: string;
  featured_image: string | null;
  comments_count: number;
  reactions_count: number;
  has_user_react: boolean;      // <-- Current user reacted?
  bookmarked: boolean;          // <-- Current user bookmarked?
  created_at: string;
  xprofile: UserProfile;
  space?: Space;
}
```

### 5. Real-time Updates
The Vue app uses `/feeds/ticker` with `last_fetched_timestamp` to poll for new posts.

---

## 🚀 What This Means for Our App

1. **Reactions work now** - Use `remove: true` parameter
2. **Bookmarks are free** - Same endpoint, `react_type: "bookmark"`
3. **Comments have different reaction API** - Use `state: 1/0`
4. **Follow/unfollow exists** - `/profile/{username}/follow`
5. **Real-time possible** - Use ticker endpoint for polling
6. **Theme colors extracted** - Can match exactly

---

## 📋 TODO Based on This Research

- [ ] Fix reaction toggle with `remove: true`
- [ ] Add bookmark functionality
- [ ] Add `has_user_react` to Feed type
- [ ] Implement comment likes properly
- [ ] Add follow/unfollow to profiles
- [ ] Consider polling with ticker endpoint
- [ ] Match color theme to CSS variables
