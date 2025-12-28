# Intro - Connect Without Connecting

## Overview
A modern dating platform for introverts and homebodies. This web application allows users to swipe through profiles, match with others, and explore virtual experiences like cafes and video chat rooms.

## Project Architecture
- **Frontend**: Static HTML/CSS/JavaScript served by Express.js
- **Backend**: Node.js with Express.js
- **Port**: 5000 (frontend server)

## Directory Structure
```
/
├── server.js          # Express server
├── package.json       # Node.js dependencies
├── public/
│   ├── index.html     # Main HTML page
│   ├── styles.css     # App styling
│   └── app.js         # Client-side JavaScript
├── pubspec.yaml       # Original Flutter config (not used)
└── README.md          # Project description
```

## Running the App
The app runs on port 5000 using the Web Server workflow:
```bash
node server.js
```

## Features
- Profile card swiping interface
- Pass/Like buttons with animations
- Bottom navigation for Discover, Matches, Experiences, Profile tabs
- Dark theme optimized for introverts
- Mobile-responsive design

## Recent Changes
- December 28, 2025: Converted from Flutter skeleton to Node.js/Express web app
