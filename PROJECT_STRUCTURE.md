# Two Birds Community App - Project Structure

## 📁 Folder Overview

```
FluentCommunityApp/
│
├── app/                      # SCREENS (Expo Router file-based routing)
│   ├── (tabs)/               # Bottom tab navigation
│   │   ├── _layout.tsx       # Tab bar configuration
│   │   ├── index.tsx         # Home/Feed tab
│   │   ├── spaces.tsx        # Spaces tab
│   │   ├── create.tsx        # Create tab (placeholder)
│   │   ├── notifications.tsx # Notifications tab (placeholder)
│   │   └── profile.tsx       # My Profile tab
│   │
│   ├── feed/                 # Feed detail screens
│   │   └── [id].tsx          # Single post view (/feed/123)
│   │
│   ├── space/                # Space screens
│   │   └── [slug].tsx        # Single space (/space/general)
│   │
│   ├── profile/              # Profile screens
│   │   └── [username].tsx    # User profile (/profile/johndoe)
│   │
│   └── _layout.tsx           # Root layout
│
├── components/               # REUSABLE UI PIECES
│   ├── common/               # Used everywhere
│   │   ├── Avatar.tsx
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── LoadingSpinner.tsx
│   │   ├── ErrorMessage.tsx
│   │   ├── EmptyState.tsx
│   │   └── VerifiedBadge.tsx
│   │
│   ├── feed/                 # Feed-specific
│   │   ├── FeedCard.tsx
│   │   ├── FeedList.tsx
│   │   ├── ReactionBar.tsx
│   │   └── CommentList.tsx
│   │
│   ├── space/                # Space-specific
│   │   ├── SpaceCard.tsx
│   │   └── SpaceList.tsx
│   │
│   └── profile/              # Profile-specific
│       ├── ProfileHeader.tsx
│       └── ProfileStats.tsx
│
├── services/                 # API CALLS
│   └── api/
│       ├── client.ts         # Base fetch with auth
│       ├── feeds.ts          # Feed endpoints
│       ├── comments.ts       # Comment endpoints
│       ├── spaces.ts         # Space endpoints
│       ├── reactions.ts      # Reaction endpoints
│       └── profiles.ts       # Profile endpoints
│
├── hooks/                    # REUSABLE LOGIC
│   ├── useFeeds.ts
│   ├── useComments.ts
│   ├── useSpaces.ts
│   ├── useReactions.ts
│   └── useProfile.ts
│
├── constants/                # CONFIGURATION
│   ├── config.ts             # API URL, credentials
│   ├── colors.ts             # Color palette
│   └── layout.ts             # Spacing, sizes
│
├── types/                    # TYPESCRIPT TYPES
│   ├── feed.ts
│   ├── comment.ts
│   ├── space.ts
│   ├── user.ts
│   └── api.ts
│
└── utils/                    # HELPER FUNCTIONS
    ├── formatDate.ts
    ├── formatNumber.ts
    └── htmlToText.ts
```

## 🎯 Phase 1 Scope

### Screens
- [x] Home Feed (view only)
- [ ] Single Post + Comments
- [ ] Spaces List
- [ ] Single Space Feed
- [ ] User Profile
- [ ] Add Reactions

### Placeholder (greyed out)
- [ ] Create Post (Phase 2)
- [ ] Notifications (Phase 2)

## 🔄 Data Flow

```
Screen → Hook → API Service → Fluent Community API
                    ↓
              Component ← Data
```

## 🚀 Getting Started

1. Copy these files to your FluentCommunityApp folder
2. Run `npx expo start`
3. Scan QR code with Expo Go

