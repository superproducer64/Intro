# Intro - Connect Without Connecting

## Overview
A modern dating platform for introverts. Features both a web app and a React Native/Expo mobile app (for Apple App Store), with swiping, matching, real-time messaging, virtual experiences, and safety features.

## Project Architecture
- **Web Frontend**: Static HTML/CSS/JavaScript served by Express.js (in `public/`)
- **Mobile Frontend**: React Native/Expo app (in `mobile/`)
- **Backend**: Node.js with Express.js (`server.js`)
- **Database**: PostgreSQL (users, profiles, messages, reports, blocks, prompts, likes, matches, interests, signups tables)
- **Auth**: bcryptjs for password hashing, token-based sessions, Sign in with Apple support
- **Real-time**: WebSocket for live messaging
- **Port**: 5000 (backend server)

## Directory Structure
```
/
├── server.js              # Express server with auth, safety & matching APIs
├── package.json           # Node.js backend dependencies
├── public/                # Web frontend
│   ├── index.html         # Main HTML with splash & auth screens
│   ├── styles.css         # App styling with animations
│   ├── app.js             # Client-side JavaScript
│   └── admin.html         # Admin console
├── mobile/                # React Native/Expo mobile app
│   ├── App.js             # App entry with splash screen & navigation
│   ├── app.json           # Expo config with iOS/Android settings
│   ├── package.json       # Mobile dependencies
│   ├── babel.config.js    # Babel config with reanimated plugin
│   ├── assets/            # App icons and splash images
│   └── src/
│       ├── constants/theme.js    # Colors, spacing, prompts
│       ├── services/api.js       # API client & WebSocket service
│       ├── navigation/AppNavigator.js  # Stack + tab navigation
│       ├── components/ReportBlockModal.js  # Report/block modal
│       └── screens/
│           ├── Auth/       # Login & Register screens
│           ├── Discover/   # Card swiping screen
│           ├── Matches/    # Matches list screen
│           ├── Chat/       # Real-time chat screen
│           ├── Experiences/ # Virtual experiences screen
│           ├── Profile/    # Profile view/edit & prompt setup
│           ├── Settings/   # Settings with delete account
│           └── Legal/      # Privacy Policy & Terms of Service
└── README.md
```

## Running the App
Backend runs on port 5000 using the Web Server workflow:
```bash
node server.js
```
Mobile app (development):
```bash
cd mobile && npx expo start
```

## Database Tables
- **users** - id, name, email, password, age, bio, apple_id, photo_url, personality_type, looking_for, location
- **profiles** - id, user_id (FK), name, bio, sort_order
- **messages** - id, sender_id, receiver_id, message, created_at
- **reports** - id, reporter_id (FK), reported_user_id (FK), reason, details
- **blocks** - id, blocker_id (FK), blocked_user_id (FK), unique constraint
- **prompts** - id, user_id (FK), prompt_question, prompt_answer
- **likes** - id, liker_id (FK), liked_user_id (FK), unique constraint
- **matches** - id, user1_id (FK), user2_id (FK), unique constraint
- **interests** - id, user_id (FK), interest
- **signups** - experience waitlist

## API Endpoints
### Auth
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- POST /api/auth/apple - Sign in with Apple

### Profiles & Matching
- GET /api/profiles - Get swipeable profiles (excludes blocked users)
- POST /api/like - Like a user (checks for mutual match)
- GET /api/matches - Get all matches for authenticated user
- GET /api/profile - Get own profile with interests & prompts
- PUT /api/profile - Update profile

### Prompts
- POST /api/prompts - Save user's prompt answers
- GET /api/prompts/:userId - Get user's prompts

### Safety & Moderation (router: safety.js, mounted at /api/safety)
- POST /api/safety/report - Report/flag a user (body: reportedUserId, reason, details) → inserts reports row (status 'open')
- POST /api/safety/block - Block a user → inserts blocks row, deletes match+likes, AND creates a reports row so the block notifies moderation. Blocked users are excluded from /api/match/profiles in both directions instantly.
- GET /api/reports - List all reports (admin only, requires ADMIN_PASSWORD). Returns camelCase fields: id, reportedUserId, reportedUserName, reporterUserId, reporterUserName, reason, details, status, createdAt. Implemented in reports.js (mounted at /api/reports).
- PATCH /api/reports/:id - Update report status (open/resolved/escalated/dismissed)
- DELETE /api/account - Delete account and wipe all data

NOTE: Apple Guideline 1.2 (UGC) compliance — mobile app shows a Terms/Community-Guidelines acknowledgment gate (GuidelinesGate wrapping MainTabs) before any UGC is shown, and report/block are accessible from both Discover and Chat.

### Photos
- POST /api/profile/photo - Upload profile photo (multipart/form-data, field: photo)
  - Stores file at public/uploads/photos/<userId>-<timestamp>.<ext>
  - Returns { photoUrl, user }

### Other
- GET /api/messages/:matchUserId - Get chat messages
- WebSocket - Real-time messaging with token auth
- POST /api/signup - Experience waitlist signup
- POST /api/hyperbeam/create - Create streaming session
- Admin endpoints (requires ADMIN_PASSWORD)

## Canonical User Shape
All auth and profile endpoints return a consistent user object:
```json
{ "id": 1, "name": "...", "email": "...", "age": 25, "bio": "...", "photos": ["url"], "prompts": [{"prompt": "...", "answer": "..."}] }
```
Built by the `buildUserShape(userId)` helper in server.js.

## Recent Changes
- June 2026: Apple 1.2 UGC fix — added safety.js router (/api/safety/report + /block); block removes user from feed instantly AND creates a moderation report; added reportUser/blockUser to mobile api.js (were missing → report/block crashed); added report/block to Discover; added global Terms gate (GuidelinesGate) before UGC + explicit Terms checkbox on Register
- April 2026: Added GET /api/reports (admin moderation list with status field)
- April 2026: Added POST /api/profile/photo (multer file upload, stores to public/uploads/photos/)
- April 2026: Standardized all user-returning endpoints to use buildUserShape() helper
- April 2026: Added status column to reports table
- April 2026: Fixed WebSocket auth to include DB fallback; flattened WS message payload to camelCase
- April 2026: Fixed /api/matches, /api/like, /api/messages response shapes for Swift client
- April 2026: Persisted auth tokens to sessions table (survives server restarts)
- March 2026: Built React Native/Expo mobile app with full feature parity
- March 2026: Added safety features (report, block, delete account)
- March 2026: Added prompt-based matching system
- March 2026: Added Sign in with Apple authentication
- March 2026: Added server-side likes/matches with mutual matching
- January 2026: Added real-time messaging with WebSocket support
- January 2026: Added animated splash screen and user authentication
- December 2025: Converted from Flutter skeleton to Node.js/Express web app
