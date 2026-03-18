# TBC App

A white-label community mobile app built on WordPress + Fluent Community. Fully compatible with iOS and Android — designed to be intuitive, lightweight, and modern.

## Features

- **Activity Feed** — Social feed with posts, multi-reactions, and threaded comments
- **Community Spaces** — Join and participate in groups
- **Event Calendar** — Browse and discover community events
- **Courses** — Structured learning content with lessons
- **Blog** — Read and comment on blog posts
- **YouTube Integration** — Embedded playlists and video content
- **Book Club** — Community reading groups
- **Direct Messages** — Real-time private messaging (Pusher)
- **User Profiles** — Member profiles, stats, badges, connections
- **Post Composer** — Rich text editor with media uploads and space selection
- **Notifications** — Push notifications with configurable settings
- **Bookmarks** — Save posts for later
- **Member Directory** — Browse and search community members
- **Donations** — Integrated donation support
- **Registration** — Multi-step signup with OTP verification

## Tech Stack

**Frontend:**
- React Native 0.83 + Expo SDK 55
- TypeScript
- Expo Router (file-based routing)
- React Native Reanimated & Gesture Handler

**Key Libraries:**
- Shopify FlashList (high-performance lists)
- Expo SecureStore (credential storage)
- 10tap Editor (rich text editing)
- Pusher (real-time WebSocket messaging)
- Expo Image Picker, Video, Audio (media handling)
- React Native WebView (embedded web content)

**Backend:**
- WordPress with Fluent Community framework
- JWT authentication (access + refresh tokens)
- Custom REST API bridge plugin (`tbc-community-app`)

## Project Structure

```
app/                          # Expo Router pages (file-based routing)
├── (tabs)/                   # Tab navigation
│   ├── index.tsx             #   Home (widget-based dashboard)
│   ├── activity.tsx          #   Activity feed
│   ├── spaces.tsx            #   Community spaces
│   ├── calendar.tsx          #   Event calendar
│   └── donate.tsx            #   Donations
├── space/[slug]/             # Space detail, members
├── profile/[username]/       # User profiles, connections
├── feed/[id].tsx             # Full-screen post viewer
├── comments/[postId].tsx     # Comment threads
├── messages/                 # Direct messaging
├── courses/                  # Course detail & lessons
├── blog/                     # Blog posts
├── youtube/                  # Video playlists
├── bookclub/                 # Book club
├── login.tsx                 # Authentication
├── register.tsx              # Multi-step registration
└── notifications.tsx         # Notification center

components/                   # Reusable React components
├── feed/                     # Feed cards, comments
├── space/                    # Space cards, headers
├── composer/                 # Post creation
├── member/                   # User/member display
├── navigation/               # Top header, user menu
├── home/                     # Home screen widgets
└── common/                   # Shared utility components

modules/                      # Feature modules (self-contained)
├── calendar/                 # Calendar module

services/                     # API and business logic
├── auth.ts                   # JWT authentication
└── api/                      # REST API services

contexts/                     # React Context providers
constants/                    # App configuration, colors, layout
hooks/                        # Custom React hooks
types/                        # TypeScript type definitions
assets/                       # Static images and icons
companion plugins/            # WordPress plugins & themes (see below)
```

## Companion Plugins

The `companion plugins/` folder contains WordPress plugins and a theme required for the backend. Clients must install these on their WordPress site.

**Fluent Community (required base):**
- `fluent-community` — Core community plugin
- `fluent-community-pro` — Pro add-on
- `fluent-messaging` — Messaging add-on

**TBC Plugins (custom backend):**
- `tbc-community-app` — Main bridge plugin, all custom REST endpoints
- `tbc-registration` — Registration flow, OTP verification & custom profile fields
- `tbc-multi-reactions` — Multi-reaction support
- `tbc-otp-verification` — OTP verification for registration
- `tbc-calendar-fluent` — Calendar plugin (WooCommerce-based events)

**Theme:**
- `fluent-starter` — Custom WordPress theme

## Getting Started

### Prerequisites

- Node.js 18+
- npm
- Expo dev client (this app uses native modules — Expo Go is not supported)
- iOS Simulator (macOS) or Android Emulator

### Installation

1. Install dependencies
   ```bash
   npm install
   ```

2. Start the development server
   ```bash
   npx expo start
   ```

3. Run on your preferred platform:
   - Press `i` for iOS Simulator
   - Press `a` for Android Emulator

### Configuration

Update `constants/config.ts` with your WordPress site URL and API endpoints. The app expects the companion plugins to be installed and activated on the WordPress backend.

### Theme System

App colors are synced from Fluent Community's color schemas (light + dark mode) via the `/tbc-ca/v1/theme/colors` REST endpoint. See `CLAUDE.md` for the full token map.

## Scripts

```bash
npx expo start              # Start development server
npx expo run:ios            # Build and run on iOS
npx expo run:android        # Build and run on Android
npm run lint                # Run ESLint
```

## License

Private
