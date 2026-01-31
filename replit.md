# Intro - Connect Without Connecting

## Overview
A modern dating platform for introverts and homebodies. This web application allows users to swipe through profiles, match with others, and explore virtual experiences like cafes, movie nights, and gaming.

## Project Architecture
- **Frontend**: Static HTML/CSS/JavaScript served by Express.js
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL (users, profiles, signups tables)
- **Auth**: bcryptjs for password hashing, localStorage sessions
- **Port**: 5000 (frontend server)

## Directory Structure
```
/
├── server.js          # Express server with auth & API
├── package.json       # Node.js dependencies
├── public/
│   ├── index.html     # Main HTML with splash & auth screens
│   ├── styles.css     # App styling with animations
│   ├── app.js         # Client-side JavaScript
│   └── admin.html     # Admin console
└── README.md          # Project description
```

## Running the App
The app runs on port 5000 using the Web Server workflow:
```bash
node server.js
```

## Features
- Animated splash screen with INTRO logo
- User signup/login with secure password hashing
- Profile card swiping interface
- Pass/Like buttons with animations
- Bottom navigation for Discover, Matches, Experiences, Profile tabs
- Virtual experiences: Movie Night & Gaming (Hyperbeam streaming)
- Admin console at /admin.html for managing profiles and signups
- Dark theme optimized for introverts
- Mobile-responsive design

## API Endpoints
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- GET /api/profiles - Get swipeable profiles
- POST /api/signup - Experience waitlist signup
- POST /api/hyperbeam/create - Create streaming session
- Admin endpoints (requires ADMIN_PASSWORD)

## Recent Changes
- January 2026: Added animated splash screen and user authentication
- January 2026: Added Gaming experience with CrazyGames integration
- January 2026: Added admin console for managing app content
- December 2025: Added Hyperbeam integration for Movie Night
- December 2025: Converted from Flutter skeleton to Node.js/Express web app
