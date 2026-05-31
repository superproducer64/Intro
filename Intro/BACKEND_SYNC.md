# Intro Backend Sync Guide

## Purpose

This document exists to prevent drift between:

- the iOS app in Xcode
- the backend/API running on Supabase

Intro is now a native SwiftUI app. It does not update through Expo.

## Source Of Truth

- iOS client source of truth: this Xcode project
- Backend source of truth: the Supabase project plus the repo-local `supabase/` directory
- API contract source of truth: must be documented whenever backend request or response shapes change

If a backend change affects app behavior, assume the iOS app also needs review.

## When Xcode Must Be Updated

You need an Xcode update and new device build when any of the following changes:

- a new screen, button, tile, or flow
- request body fields
- response JSON fields
- endpoint paths
- authentication behavior
- WebSocket message shapes
- Terms, EULA, privacy, or legal acceptance flow
- push notification behavior
- any native capability like Sign in with Apple, APNs, camera, mic, or background behavior

You usually do not need an iOS code change only when:

- the backend implementation changes internally
- the database changes internally
- performance changes without changing API behavior
- the domain/infrastructure changes but the app still points at the same working host and the contract is unchanged

## Current Known Contract Areas

Review these files whenever backend changes land:

- `Intro/APIService.swift`
- `Intro/LoginScreen.swift`
- `Intro/RegisterScreen.swift`
- `Intro/NewDiscoverScreen.swift`
- `Intro/NewMatchesScreen.swift`
- `Intro/NewChatScreen.swift`
- `Intro/NewSettingsScreen.swift`
- `Intro/IntroApp.swift`
- `Intro/Intro.entitlements`

## Current Assumptions In The iOS App

These are active assumptions in the client and should be verified against backend changes:

- Register request includes `name`, `email`, `password`, `age`, `bio`, `acceptedTerms`
- User objects may include `photos: [String]`
- Like endpoint is `POST /api/like`
- Pass endpoint is `POST /api/pass` with `passedUserId`
- Matches endpoint is `GET /api/matches`
- Messages endpoint is `GET /api/messages/{matchUserId}`
- WebSocket server is authenticated with `{ "type": "auth", "token": "..." }`
- Chat send payload is `{ "type": "message", "receiverId": "...", "text": "..." }`

If backend names differ, update the client immediately.

## Missing Contract: Profile Photo Upload

The iOS app currently supports:

- choosing a profile photo during signup
- storing that photo locally on-device
- decoding `photos` from backend `User` responses if present

The backend currently appears to be missing the write path needed to make photos shared across devices and visible to other users.

### Required Backend Route

Recommended new route:

- `POST /api/profile/photo`

Requirements:

- requires bearer auth
- accepts one image upload
- stores the file in backend-managed storage
- returns the updated user or at minimum the uploaded photo URL

Recommended request shape:

- `multipart/form-data`
- field name: `photo`

Recommended response shape:

```json
{
  "photoUrl": "https://your-cdn-or-storage.example.com/uploads/abc.jpg",
  "user": {
    "id": 123,
    "name": "Sean",
    "email": "sean@example.com",
    "age": 28,
    "bio": "Quiet but funny",
    "photos": [
      "https://your-cdn-or-storage.example.com/uploads/abc.jpg"
    ],
    "prompts": []
  }
}
```

### User Response Contract

These endpoints should all return compatible `User` objects including `photos`:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/apple`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/profiles`
- `GET /api/matches`

If `photos` is omitted on some endpoints but present on others, the iOS app will behave inconsistently.

### Storage Rule

The backend should store photo URLs, not raw base64 image strings, in the user record.

Recommended persisted user field:

- `photos: string[]`

Recommended initial behavior:

- first uploaded photo becomes `photos[0]`
- `photos[0]` is treated as the primary profile image

### iOS Follow-Up Once Backend Exists

After this route exists, the Xcode app should:

1. upload the selected image after registration/profile setup
2. replace local-only fallback with backend URL as source of truth
3. render remote `user.photos.first` in profile, discover, and matches
4. keep local storage only as a temporary upload fallback if needed

## Supabase Change Intake Checklist

Whenever something changes in Supabase, capture these details before touching Xcode:

1. What changed
2. Exact date of the change
3. Endpoint path(s) affected
4. Old request shape
5. New request shape
6. Old response shape
7. New response shape
8. Whether auth behavior changed
9. Whether WebSocket behavior changed
10. Whether legal copy or acceptance requirements changed

## iOS Sync Checklist

After a backend change:

1. Review `APIService.swift` for endpoint and payload changes.
2. Review the relevant screen for UI/flow changes.
3. Update legal text if Terms or EULA changed.
4. Build the Xcode project.
5. Run on at least one simulator.
6. Run on at least one physical iPhone for native flows.
7. If messaging changed, test with two accounts on two devices.
8. If push changed, verify APNs token capture and actual delivery separately.

## Messaging Regression Checklist

If backend changes touch matches, chat, or sockets:

1. Log in with two accounts.
2. Confirm profiles load.
3. Create a match.
4. Open the same chat on both devices.
5. Send messages both directions.
6. Background one device and send again.
7. Reopen and confirm reconnect/history behavior.
8. Check Xcode console for socket auth, receive, or send errors.

## Release Discipline

Do not assume “backend updated” means “iPhone app updated.”

Before saying a feature is done:

1. Confirm backend contract
2. Confirm Xcode client changes, if needed
3. Build successfully
4. Test on device

## Recommended Workflow

Best practice for Intro:

1. Make backend changes in one place.
2. Document the contract change immediately.
3. Update the iOS app in Xcode in the same session.
4. Test the changed flow on device before moving on.

Supabase is now the target backend platform. Do not treat the iPhone app as synced until the corresponding Supabase schema, policies, storage rules, or edge functions are implemented and tested.

## Supabase Backend Handoff

Use this section as the copy-paste implementation brief for the backend.

### Goal

Bring the Supabase backend into alignment with the current iPhone app so that:

- profile photo uploads work across devices
- reported users can be reviewed in an admin/moderation screen
- blocked users are removed from discovery/matching

### Required Endpoints

#### 1. Report User

- Method: `POST /api/report`
- Auth: required

Request body:

```json
{
  "reportedUserId": 42,
  "reason": "harassment",
  "details": "Sent abusive messages after matching."
}
```

Success response:

```json
{
  "message": "Report submitted"
}
```

Backend requirements:

- create a persistent moderation report record
- store reporter user id from auth token/session
- store reported user id from request
- store reason and details
- store `createdAt`
- default report status to `open`

#### 2. Block User

- Method: `POST /api/block`
- Auth: required

Request body:

```json
{
  "blockedUserId": 42
}
```

Success response:

```json
{
  "message": "User blocked"
}
```

Backend requirements:

- create a persistent block record
- blocker user id comes from auth
- blocked user id comes from request
- prevent blocked users from appearing in discovery
- prevent blocked users from appearing in matches if product policy requires that
- prevent either direction from surfacing if blocker-blocked relationship exists

#### 3. Retrieve Reports

- Method: `GET /api/reports`
- Auth: required
- Access: admin or moderator only

Success response:

```json
[
  {
    "id": 1,
    "reportedUserId": 42,
    "reportedUserName": "Alex",
    "reporterUserId": 7,
    "reporterUserName": "Sam",
    "reason": "harassment",
    "details": "Sent abusive messages after matching.",
    "status": "open",
    "createdAt": "2026-04-09T18:22:00Z"
  }
]
```

Notes:

- field names may also be returned in snake_case; the iPhone scaffold can decode both common forms
- if the endpoint does not exist, the iPhone app will show an unavailable/error state
- this endpoint should not be public to standard users

#### 4. Upload Profile Photo

- Method: `POST /api/profile/photo`
- Auth: required
- Content type: `multipart/form-data`
- Field name: `photo`

Success response:

```json
{
  "photoUrl": "https://your-storage.example.com/uploads/abc.jpg",
  "user": {
    "id": 7,
    "name": "Sam",
    "email": "sam@example.com",
    "age": 28,
    "bio": "Quiet but funny",
    "photos": [
      "https://your-storage.example.com/uploads/abc.jpg"
    ],
    "prompts": []
  }
}
```

Backend requirements:

- accept image upload from multipart form data
- store image in persistent storage
- save returned URL in user profile data
- use `photos[0]` as primary profile image
- return the updated user object if possible

### Required User Contract Consistency

These endpoints must return compatible `User` objects with `photos` when available:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/apple`
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/profiles`
- `GET /api/matches`

Recommended user shape:

```json
{
  "id": 7,
  "name": "Sam",
  "email": "sam@example.com",
  "age": 28,
  "bio": "Quiet but funny",
  "photos": [
    "https://your-storage.example.com/uploads/abc.jpg"
  ],
  "prompts": [
    {
      "prompt": "I recharge by...",
      "answer": "Reading in silence."
    }
  ]
}
```

### Recommended Database Tables Or Collections

#### reports

- `id`
- `reporter_user_id`
- `reported_user_id`
- `reason`
- `details`
- `status`
- `created_at`
- `updated_at`

Recommended status values:

- `open`
- `reviewing`
- `resolved`
- `dismissed`

#### blocks

- `id`
- `blocker_user_id`
- `blocked_user_id`
- `created_at`

Recommended uniqueness rule:

- unique pair on blocker + blocked

### Discovery / Matching Query Rules

When generating discovery candidates for a user:

- exclude users they have blocked
- exclude users who have blocked them
- exclude their own user id

When generating matches:

- decide whether a prior match should remain visible after a block
- if policy is safety-first, hide blocked relationships from matches and chat lists too

### Storage Rules For Photos

- store URLs in the user profile, not base64 image blobs
- persistent file storage must survive deploy/restart
- if using object storage or CDN, save the final public or signed-serving URL

### Suggested Backend Validation

Before saying the Replit work is complete:

1. Submit a report from the iPhone app and confirm a row/document is created.
2. Call `GET /api/reports` and confirm the new report appears.
3. Block a user from the iPhone app and confirm they disappear from discovery.
4. Upload a profile photo from the iPhone app and confirm:
   `POST /api/profile/photo` returns `photoUrl`
   `GET /api/profile` returns `photos`
   `GET /api/profiles` returns `photos` for other users
5. Reinstall or log in on a second device and confirm the photo still appears.

### Copy-Paste Request For Backend AI / Engineer

```text
Update the Intro Replit backend to support iPhone moderation and shared profile photos.

Required work:

1. Implement POST /api/report
- auth required
- body: { reportedUserId, reason, details }
- persist report with reporter from auth, status=open, createdAt
- return { message: "Report submitted" }

2. Implement POST /api/block
- auth required
- body: { blockedUserId }
- persist block record
- return { message: "User blocked" }
- blocked users must be excluded from discovery, and ideally from matches/chat visibility too

3. Implement GET /api/reports
- auth required
- admin/moderator only
- return list of reports with:
  id
  reportedUserId
  reportedUserName
  reporterUserId
  reporterUserName
  reason
  details
  status
  createdAt

4. Implement POST /api/profile/photo
- auth required
- multipart/form-data
- field name: photo
- store uploaded image in persistent storage
- save URL into user.photos array
- return:
  {
    photoUrl,
    user
  }

5. Ensure these endpoints return consistent User objects including photos:
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/apple
- GET /api/profile
- PUT /api/profile
- GET /api/profiles
- GET /api/matches

User shape must include:
- id
- name
- email
- age
- bio
- photos: string[]
- prompts: [{ prompt, answer }]

This must match the native iPhone app contract exactly.
```
