# Two Birds Community App - Complete Installation

## Step 1: Extract Files

Extract this zip and copy ALL folders into your FluentCommunityApp directory:
- `app/` → merge with your existing `app/` folder
- `components/` → REPLACE your existing `components/` folder  
- `constants/` → REPLACE your existing `constants/` folder
- `services/` → REPLACE your existing `services/` folder
- `types/` → REPLACE your existing `types/` folder
- `utils/` → REPLACE your existing `utils/` folder

## Step 2: Install Required Packages

Run these commands in your terminal:

```bash
# YouTube in-app playback
npm install react-native-youtube-iframe

# Video player and gradients
npx expo install expo-av expo-linear-gradient
```

## Step 3: Clear Cache and Start

```bash
npx expo start --clear
```

## Step 4: Scan QR Code

Open Expo Go on your phone and scan the QR code.

---

## What's Included

### Features
- ✅ Feed with media (images, YouTube, videos)
- ✅ Instagram-style full-screen post view
- ✅ Swipe between posts
- ✅ Comments slide-up panel
- ✅ YouTube plays IN-APP
- ✅ Direct video playback
- ✅ Link previews for Instagram, TikTok, etc.
- ✅ Pull to refresh
- ✅ Reactions

### File Structure
```
app/
├── (tabs)/
│   └── index.tsx         # Home feed screen
└── feed/
    └── [id].tsx          # Full-screen post detail

components/
├── common/               # Avatar, Loading, Error, Empty
├── feed/                 # FeedCard, FeedList, FullScreenPost, CommentSheet
├── media/                # MediaRenderer, YouTubeEmbed, VideoPlayer, etc.
└── space/                # SpaceCard

constants/                # Config, colors, layout
services/api/             # API client, feeds, comments, spaces, profiles
types/                    # TypeScript definitions
utils/                    # Formatters (date, number, HTML)
```

## Troubleshooting

### "Unable to resolve module expo-av"
Run: `npx expo install expo-av`

### "Unable to resolve module expo-linear-gradient"
Run: `npx expo install expo-linear-gradient`

### "Unable to resolve module react-native-youtube-iframe"
Run: `npm install react-native-youtube-iframe`

### App not connecting
1. Stop server (Ctrl+C)
2. Run: `npx expo start --clear`
3. Force close Expo Go on phone
4. Reopen and scan QR code
