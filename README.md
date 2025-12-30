# Two Birds Community App

A React Native mobile application for the Two Birds Church community. This app connects church members through social features, community spaces, events, and more.

## Features

- **Activity Feed** - Social feed with posts, reactions (likes/loves), and comments
- **Community Spaces** - Join and participate in community groups
- **Event Calendar** - Browse church events with WebView integration
- **User Profiles** - View member profiles, stats, badges, and activities
- **Post Composer** - Create posts with media, space selection, and rich formatting
- **Notifications** - Stay updated with community activity
- **Bookmarks** - Save favorite posts for later
- **Direct Messages** - Communication between members

## Tech Stack

**Frontend:**
- React Native 0.81 + Expo SDK 54
- TypeScript
- Expo Router (file-based routing)
- React Native Reanimated & Gesture Handler

**Key Libraries:**
- Shopify Flash List (high-performance lists)
- Expo Secure Store (credential storage)
- Expo Image Picker & AV (media handling)
- React Native WebView (embedded web content)

**Backend:**
- WordPress with Fluent Community framework
- Custom REST API plugin (`tbc-community-app.php`)
- Basic Authentication

## Project Structure


app/ # Expo Router pages (file-based routing)
├── (tabs)/ # Tab navigation (Home, Activity, Spaces, Calendar)
├── space/[slug]/ # Dynamic space routes
├── profile/[username] # User profile pages
├── feed/[id] # Full-screen post viewer
└── login.tsx # Authentication screen

components/ # Reusable React components
├── feed/ # Feed, FeedCard, CommentSheet, etc.
├── space/ # SpaceCard, SpaceHeader, SpaceMenu
├── composer/ # Post creation components
├── member/ # User/member display components
├── navigation/ # TopHeader and nav components
└── common/ # Shared utility components

services/ # API and business logic
├── auth.ts # Authentication service
└── api/ # REST API services (feeds, spaces, profiles, etc.)

contexts/ # React Context providers
├── AuthContext.tsx # Global authentication state

types/ # TypeScript type definitions
constants/ # App configuration, colors, layout
hooks/ # Custom React hooks
assets/ # Static images and icons


## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/twobirdshealing/TwoBirdsCommunityApp.git
   cd TwoBirdsCommunityApp

Install dependencies

npm install

Start the development server

npx expo start

Run on your preferred platform:

Press i for iOS Simulator
Press a for Android Emulator
Scan QR code with Expo Go app on physical device
Development Scripts
npx expo start          # Start development server
npx expo start --ios    # Start and open iOS simulator
npx expo start --android # Start and open Android emulator
npx expo start --web    # Start web version
npm run lint            # Run ESLint
npm run reset-project   # Reset to blank project

Configuration
The app connects to the Two Birds Church backend. API configuration is in constants/config.ts:

export const API_BASE_URL = 'https://staging.twobirdschurch.com/wp-json/fluent-community/v2';

Authentication
The app uses Basic Authentication with credentials stored securely via expo-secure-store. Users log in with their WordPress username/email and password.

Contributing
Create a feature branch from main
Make your changes
Test on both iOS and Android
Submit a pull request
Backend Plugin
The custom WordPress plugin (tbc-community-app.php) provides additional REST API endpoints for the mobile app. This should be installed on the WordPress site.

License
Private - Two Birds Church