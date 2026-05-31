# Intro Master Docs Export

Purpose: provide one combined markdown document that merges the current project planning, release, migration, demo, and security documents into a single export file.

Project location:
- `/Users/seanconnolly/Desktop/DO NOT DELETE_Xcode Projects/Intro_v2/Intro/Intro/`

Included source documents:
1. `BACKEND_SYNC.md`
2. `DEMO_READINESS_CHECKLIST.md`
3. `PROGRESS_NOTES.md`
4. `RELEASE_CHECKLIST.md`
5. `SECURITY_REVIEW_REPORT.md`
6. `SUPABASE_CUTOVER_CHECKLIST.md`
7. `SUPABASE_MIGRATION_PLAN.md`
8. `WORKING_RULES.md`

---

# BACKEND_SYNC.md

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

---

# DEMO_READINESS_CHECKLIST.md

# Intro Demo Readiness Checklist

Purpose: finish a stable demo build in the next few days without expanding scope.

Use this document to:
- lock the demo scope
- test each demo-critical topic in order
- record failures immediately
- separate demo blockers from acceptable demo limitations

## Demo Standard

For the demo, a flow is considered ready when:
1. it builds
2. it runs on a real iPhone
3. the main happy path works end to end
4. any known limitation is either fixed, hidden, or acceptable for the demo

Do not broaden scope while this checklist is still open.

## Must Pass For Demo

### Auth

- [ ] Register with email/password
- [ ] Log in with email/password
- [ ] Log out successfully
- [ ] Relaunch app and restore session
- [ ] Handle auth failure with a visible user-facing error

Notes:
- If `appleSignIn` is not finished, hide it or label it as unavailable before demo.

### Legal / Entry Flow

- [ ] Terms / EULA flow appears when expected
- [ ] User can continue through the expected entry path

### Profile Setup

- [ ] Complete profile setup
- [ ] Save prompts successfully
- [ ] Choose avatar successfully
- [ ] Add profile photo successfully
- [ ] Finish setup without app state drift after relaunch

### Profile / Appearance

- [ ] Load profile screen successfully
- [ ] Remote photo renders when available
- [ ] Local fallback photo renders when remote photo is unavailable
- [ ] Avatar fallback renders when no photo exists
- [ ] Edit appearance and save avatar selection
- [ ] Upload replacement photo from profile screen
- [ ] Use avatar-only mode and confirm photo removal does not drift

### Discover

- [ ] Discover screen loads profiles
- [ ] Pass action works
- [ ] Like action works
- [ ] Refresh loads additional profiles or shows stable empty state
- [ ] Profile images render or degrade gracefully

### Matches

- [ ] Matches screen loads
- [ ] Match cards render stable data
- [ ] Match photo renders or degrades gracefully
- [ ] Tap into chat from match card

### Chat

- [ ] Chat history loads
- [ ] Send message works
- [ ] Incoming message appears within acceptable demo delay
- [ ] Reopen chat without broken state
- [ ] Relaunch app and reopen chat successfully

Notes:
- Current polling fallback is acceptable for demo if it is stable and clearly not broken.

### Moderation

- [ ] Report user action works
- [ ] Block user action works
- [ ] Blocked user no longer appears where expected
- [ ] Moderator-role account can open reports if moderation is part of demo

### Settings / Navigation

- [ ] Main tab navigation is stable
- [ ] Settings screen opens
- [ ] Profile -> Settings path works
- [ ] Any visible demo navigation targets are functional

## Hide Before Demo

- [ ] Hide Hyperbeam or any dropped experience entry points
- [ ] Hide unfinished Sign in with Apple if not completed
- [ ] Hide any button that leads to known broken flow
- [ ] Remove or hide any admin-only entry point from non-admin demo accounts

## Acceptable For Demo If Stable

- Chat uses polling instead of final Realtime implementation
- Internal model layer still bridges legacy `Int` ids to Supabase UUIDs
- Some screens degrade gracefully when optional backend data is missing

These are acceptable only if the user-facing flow remains stable.

## Not Acceptable For Demo

- App crash on core flow
- Infinite loading spinner on core flow
- Session restore breaks auth state
- Profile photo state drifts across screens in a visible way
- Discover, matches, or chat fail entirely due to one bad row
- A dropped feature remains visible and broken

## Demo Test Order

Run this order on a real device whenever possible:

1. Fresh install
2. Register
3. Terms / EULA
4. Profile setup with avatar and optional photo
5. Relaunch and confirm session restore
6. Open profile and edit appearance
7. Open discover and like/pass
8. Create or load a match
9. Open chat and send messages with a second account
10. Test report/block flow
11. Log out
12. Log back in

## Issue Log Template

Copy this block for each problem found:

```text
Topic:
Scenario:
Expected:
Actual:
Severity: demo-blocking / important / non-blocking
Area:
Backend or Client:
Status: open / fixed / deferred / hidden
Notes:
```

## Suggested Severity Rules

- `demo-blocking`
  - prevents completing a core demo flow
  - causes crash, broken auth state, or unusable screen

- `important`
  - flow works but looks obviously wrong or unstable
  - should be fixed if time allows before demo

- `non-blocking`
  - polish issue or known limitation with a stable fallback

## Daily Closeout

At the end of each day:
1. mark completed demo topics
2. list newly found issues
3. mark each issue as fixed, deferred, or hidden
4. rebuild the app
5. rerun the highest-risk demo path

## Current Focus Recommendation

Based on the current codebase, focus first on:
1. auth and session restore
2. profile setup and photo state
3. discover, matches, and chat
4. moderation only if it will be shown in the demo

Do not spend the next few days on broad refactors unless they are directly tied to demo stability.

---

# PROGRESS_NOTES.md

# Intro App Migration - Progress Notes
Date: April 4, 2026

## ✅ Completed Today:
- Migrated full Expo app to SwiftUI
- Created all 10+ screens (Login, Register, Discover, Matches, Chat, etc.)
- Added EULA modal (Terms of Use)
- Connected to Replit backend
- WebSocket real-time chat working
- App builds and runs on iPhone (iOS 17.6)

## ⚠️ To Fix Tomorrow:
- Apple Sign In gives Error 1000
- Need to configure "Sign in with Apple" capability
- May need to add Intro.entitlements file
- Email/Password login works fine as alternative

## 📱 App Structure:
- Backend: 70938a94-157f-4b05-b6f7-ac9b7fc375b2-00-34ozt3aky4587.riker.replit.dev
- Theme: Dark purple with pink primary (#e94560)
- Storage: UserDefaults for auth token
- Models: User, UserMatch, ChatMessage, PromptAnswer

## 🔧 If Build Issues:
- Clean: Cmd + Shift + K
- Rebuild: Cmd + R
- Delete DerivedData if needed

## Next Session:
Ask AI: "Continue working on Intro dating app - need to fix Apple Sign In Error 1000"

---

# RELEASE_CHECKLIST.md

# Intro Release Checklist

Use this before:

- testing on a physical iPhone
- sending a build to someone else
- preparing for TestFlight

## Backend

1. Confirm the Supabase project URL and environment are correct.
2. Confirm any recent schema, policy, storage, or function changes were reviewed against `BACKEND_SYNC.md`.
3. Confirm request and response shapes still match the iOS app for any legacy endpoints still in use.
4. Confirm the active flow is using the intended backend path: Supabase, legacy backend, or mixed-mode by design.
5. Confirm no privileged Supabase secret is present in the iOS app.

## Build

1. Build the Xcode project successfully.
2. Resolve any Xcode warnings or errors that affect the changed flow.
3. Confirm signing is valid for the selected Apple team.
4. Confirm the target device is correct.

## Core App Flow

1. Launch the app from Xcode on a real iPhone.
2. Confirm login works.
3. Confirm registration works.
4. Confirm Terms/EULA flow works.
5. Confirm profile setup works.
6. Confirm tab navigation works.
7. Confirm session restore works after app relaunch.

## Discover And Matches

1. Confirm profiles load in Discover.
2. Confirm pass action works.
3. Confirm like action works.
4. Confirm match creation works when test data is available.

## Messaging

1. Test with two accounts on two devices if messaging changed.
2. Confirm chat history loads.
3. Confirm send works both directions.
4. Confirm reopen works after backgrounding and reopening.
5. Confirm the polling fallback still presents a stable chat experience if Realtime is not active.
6. Check the Xcode console for WebSocket auth, receive, or send errors.

## Moderation And Safety

1. Confirm the Safety Center is reachable from Settings.
2. Confirm report and block actions are available from profile moderation entry points.
3. Confirm blocked users no longer appear in the expected user-facing flows.
4. Confirm moderation reports are only reachable for moderator or admin accounts.

## Notifications And Native Capabilities

1. Confirm notification permission prompt appears when expected.
2. Confirm APNs token is captured on a physical device.
3. Confirm any native capability changes were tested on hardware, not just simulator.
4. Confirm Sign in with Apple is configured if that flow is expected to work.

## Supabase Security Checks

1. Confirm RLS is enabled on newly used user-facing tables.
2. Confirm a normal user cannot access moderator/admin-only data.
3. Confirm profile photo storage rules match the intended privacy model.
4. Confirm the app is using the public `anon` key only.

## Before TestFlight

1. Switch any push setup from development-only assumptions to production requirements.
2. Confirm legal copy is current.
3. Confirm version and build number are updated.
4. Confirm at least one successful device run on the release candidate build.

## Release Rule

Do not call a feature finished until:

1. it builds
2. it runs on a real device
3. the backend contract is confirmed
4. the actual user flow was exercised end to end

---

# SECURITY_REVIEW_REPORT.md

# Intro iOS App System Review

Date: April 4, 2026
Scope: iOS client code present in this repository
Build status at review time: Builds successfully

## Executive Summary

The app currently builds, but it has several meaningful privacy and security weaknesses that should be addressed before release. The highest-risk issues are verbose logging of network responses and user state, persistence of an admin moderation session beyond normal logout, and exposure of moderation entry points in ordinary user navigation. There are also medium-risk issues around weak local data storage choices, permissive web content loading, and onboarding state inconsistency.

This review covers only the iOS client in this repository. Backend authorization, rate limiting, audit trails, and server-side moderation enforcement still need to be verified separately.

## Findings

### 1. High: Sensitive server data is logged in production code

Files:
- `Intro/APIService.swift`
- `Intro/IntroApp.swift`
- `Intro/ContentView.swift`

Details:
- The client logs request URLs, response status codes, full response bodies, current user names, auth state, device token values, and assorted error payloads.
- In a dating app, these logs can contain profile data, moderation data, chat content, device identifiers, and other sensitive information.

Risk:
- Privacy leakage through device logs, attached diagnostics, crash reports, or captured console output during testing and support workflows.

Recommended fix:
- Remove or gate sensitive logs behind a debug-only logger that redacts values.

### 2. High: Admin moderation access is reachable from normal user navigation

Files:
- `Intro/NewSettingsScreen.swift`
- `Intro/NewProfileScreen.swift`
- `Intro/ModerationReportsScreen.swift`
- `Intro/APIService.swift`

Details:
- The app exposes navigation to the moderation reports screen from standard user-facing settings and profile flows.
- The screen itself still depends on admin login, but the route is visible to all users.
- The admin token is stored independently from the normal auth token.

Risk:
- Accidental or inappropriate access path to privileged tooling.
- Increased chance of privilege confusion on shared devices.

Recommended fix:
- Hide moderation entry points unless an admin session is already active, or move the admin tools behind a clearly separate flow.

### 3. High: Admin session is not cleared during standard logout

Files:
- `Intro/APIService.swift`

Details:
- `clearAuth()` removes the normal auth token and user state, but does not clear `adminToken`.
- A moderator/admin session can therefore outlive a regular user session on the same device.

Risk:
- Cross-user access to moderation data if the device is reused.

Recommended fix:
- Clear admin auth whenever normal auth is cleared, unless there is a deliberate product requirement not to.

### 4. Medium-High: PII is stored in UserDefaults

Files:
- `Intro/APIService.swift`

Details:
- The app stores the serialized current user record, profile completion state, avatar selection, and push token in `UserDefaults`.
- Auth tokens are kept in Keychain, which is better, but user profile data still appears to be stored in a weaker location.

Risk:
- Increased privacy exposure on device backups, diagnostics, and local inspection.

Recommended fix:
- Move sensitive persisted user data to Keychain or a protected file with an explicit data-protection class.

### 5. Medium: Arbitrary URLs can be loaded in the in-app web view

Files:
- `Intro/HyperbeamExperienceScreen.swift`

Details:
- `embedUrl` is converted directly to a `URL` and loaded in `WKWebView`.
- No allowlist or navigation restrictions are applied.

Risk:
- Rendering arbitrary or malicious content inside the app shell if upstream content is compromised.

Recommended fix:
- Allow only `https` and restrict to known trusted hosts used for the Hyperbeam experience flow.

### 6. Medium: WebSocket is marked connected before auth is confirmed

Files:
- `Intro/APIService.swift`

Details:
- The client marks the WebSocket as connected after sending the auth message, not after receiving confirmation from the server.

Risk:
- Reliability issues, message loss, and false-positive connected state.

Recommended fix:
- Wait for a server acknowledgment before exposing a connected state to the rest of the app.

### 7. Medium: Profile setup can complete after save failure

Files:
- `Intro/ProfileSetupScreen.swift`

Details:
- On failure in `savePrompts()`, the UI still marks profile setup complete and advances the user.

Risk:
- Inconsistent client/server state and bypass of required onboarding.

Recommended fix:
- Keep the user in the flow on failure and surface a retry path.

### 8. Medium: Moderation/reporting lacks meaningful client-side friction

Files:
- `Intro/ModerationActionSheet.swift`

Details:
- Reports can be submitted with empty details.
- The UI does not show any local rate controls beyond temporary button disabling.

Risk:
- Abuse or noisy moderation submissions.

Recommended fix:
- Add basic validation in the client, but rely primarily on backend rate limiting and abuse handling.

### 9. Low-Medium: Seed profiles appear in the live discover flow on API failure

Files:
- `Intro/NewDiscoverScreen.swift`

Details:
- If profile loading fails, the app falls back to hardcoded sample profiles in the main experience.

Risk:
- Misleading behavior, noisy analytics, and possible moderation/report flows against fake users.

Recommended fix:
- Replace with an explicit empty/error state instead of synthetic live data.

## Verified at Review Time

- The project built successfully.
- `ModerationReportsScreen.swift` had been repaired and no longer showed file-level diagnostics.

## Backend Validation Still Required

The following items cannot be verified from this repository:

- Server-side role checks for admin and moderation endpoints
- WebSocket auth acknowledgment protocol
- Server-side rate limiting and anti-abuse controls
- Server-side deletion semantics and retention policies
- TLS pinning or certificate hardening strategy
- Moderation audit logging and review workflow guarantees

## Recommended Immediate Remediation Order

1. Remove or redact sensitive logs.
2. Clear admin auth on normal logout.
3. Hide moderation entry points from normal users.
4. Restrict allowed web view destinations.
5. Fix profile setup so failed saves do not mark completion.
6. Review local persistence for sensitive user data.

---

# SUPABASE_CUTOVER_CHECKLIST.md

# Supabase Cutover Checklist

Date: April 4, 2026
Purpose: make the transition from the current backend to Supabase predictable and reversible

## Principle

Do not cut over by intuition.

Cut over only when:
- schema is deployed
- RLS is enabled and tested
- storage rules are tested
- iOS client paths are switched intentionally
- fallback or rollback is defined

## Supabase Project Setup

1. Confirm the Supabase project exists and is the intended environment.
2. Record the exact project URL.
3. Record the `anon` key for the iOS app.
4. Keep the `service_role` key out of the iOS app entirely.
5. Decide now whether you will have separate development and production Supabase projects.
6. Enable email auth and configure Sign in with Apple if Apple login will remain supported.
7. Confirm the auth redirect settings are correct for iOS.

## Repo Setup

1. Keep SQL migrations under `supabase/migrations/`.
2. Keep any Edge Functions under `supabase/functions/`.
3. Keep the iOS integration plan in this repo.
4. Do not make dashboard-only changes without recording them in the repo.

## Foundation Schema

Before the first client cutover, verify:
- `profiles` exists
- `profile_prompts` exists
- `user_roles` exists
- `push_tokens` exists
- `handle_new_user()` trigger exists
- RLS is enabled on all user-facing tables
- self-access policies work for authenticated users

## Storage

Before moving profile photos:
- create the `profile-photos` bucket
- decide whether objects are private or served via signed URLs
- confirm upload policy only allows writes for the current user path
- confirm read policy matches your privacy model

## Client Configuration

Before changing `APIService.swift`:
- decide how Supabase URL and key will be injected into the app
- avoid hardcoding credentials directly in business logic
- define dev and production configuration strategy
- decide whether legacy Replit config stays temporarily during the phased migration

## Identity Model

This is a required decision:
- current app uses `Int` ids
- Supabase Auth uses `UUID`

Before moving data access:
1. choose `UUID` as the app-side user identifier type
2. update the Swift models deliberately
3. identify every screen depending on `Int` user ids

## Phase 1 Cutover Scope

Only cut over these paths first:
- sign up
- login
- Apple sign in
- get current profile
- update profile
- prompt save or load if ready

Do not cut over first:
- chat
- realtime
- discovery ranking logic
- moderation dashboards

## RLS Validation

For every table added to `public`:
1. confirm RLS is enabled
2. confirm the intended user can read their own rows
3. confirm the intended user can write only their own rows
4. confirm a different authenticated user cannot read or mutate those rows

For moderation tables:
1. confirm normal users can submit reports if intended
2. confirm normal users cannot read all reports
3. confirm moderator or admin access is role-based, not password-based

## Auth Validation

Before release:
1. register a new account
2. sign out and sign back in
3. relaunch the app and confirm session restore
4. confirm protected profile reads still work after relaunch
5. confirm Apple login returns a usable profile row

## Profile Validation

1. create a new account
2. complete profile setup
3. save prompts
4. change name, bio, and age
5. confirm the updated values round-trip from Supabase

## Photo Validation

1. upload a profile photo
2. confirm the object appears in Storage
3. confirm the profile row stores the expected path
4. confirm the image renders after app relaunch
5. confirm the image renders on a second device if applicable

## Rollback Plan

Before the first live cutover, define:
- what flag or code path returns auth and profile traffic to the legacy backend
- which parts of the app are fully migrated
- which parts are still legacy
- what data would be lost if you revert

If you cannot answer those questions, you are not ready to cut over.

## Recommended First Milestone

Call the first milestone complete only when:
- Supabase Auth is live for the app
- profile reads and updates use Supabase
- prompts and profile setup state are persisted in Supabase
- photo upload path is either live or explicitly deferred
- no core auth or profile flow still depends on the legacy auth token path

## Recommended Next Milestone

Only after the first milestone is stable:
- move discovery and matches
- then move chat and realtime
- then move moderation and privileged workflows

---

# SUPABASE_MIGRATION_PLAN.md

# Supabase Migration Plan

Date: April 4, 2026
Target architecture: Xcode app + Supabase backend
Current backend: Custom API hosted externally

## Goal

Move the Intro dating app off the current custom backend and onto Supabase in staged phases, while keeping the iOS app operational during the transition.

This plan is designed to:
- reduce backend security risk
- consolidate infrastructure into Supabase
- keep the Xcode project as the primary application codebase
- avoid a full cutover rewrite on day one

## Current API Surface

The current `APIService.swift` surface is:

- Auth
  - `register`
  - `login`
  - `appleSignIn`
  - `deleteAccount`
- Profile
  - `getProfile`
  - `updateProfile`
  - `savePrompts`
  - `getPrompts`
  - `uploadProfilePhoto`
- Discovery
  - `getProfiles`
  - `likeUser`
  - `passUser`
- Matches and chat
  - `getMatches`
  - `getMessages`
  - `connectWS`
  - `sendWSMessage`
- Moderation
  - `reportUser`
  - `blockUser`
  - `adminLogin`
  - `getReports`
- Experiences
  - `createHyperbeamSession`

## Supabase Target Mapping

### Auth

Use Supabase Auth for:
- email/password sign-up
- email/password login
- Sign in with Apple
- session lifecycle

Remove:
- custom auth token issuing
- custom admin password flow

### Database

Use Postgres tables for:
- `profiles`
- `profile_prompts`
- `user_activities`
- `swipes`
- `matches`
- `messages`
- `blocks`
- `reports`
- `user_roles`
- `push_tokens`
- optional `hyperbeam_sessions`

### Storage

Use Supabase Storage for:
- profile photos

Suggested bucket:
- `profile-photos`

### Realtime

Use Supabase Realtime for:
- message subscriptions in chat

### Edge Functions

Use Supabase Edge Functions for:
- match creation side effects if not handled in SQL/RPC
- Hyperbeam session creation
- moderator/admin report retrieval if role checks need a privileged path
- APNs token registration if you want a server-controlled path for push workflows

## Migration Phases

### Phase 1: Auth and profile foundation

Build:
- Supabase Auth project configuration
- `profiles` table
- `profile_prompts` table
- `user_roles` table
- `push_tokens` table
- profile auto-create trigger from `auth.users`

Update iOS:
- replace `register`
- replace `login`
- replace `appleSignIn`
- replace `getProfile`
- replace `updateProfile`

### Phase 2: Prompts and profile completion

Build:
- prompts persistence
- profile setup completion field in `profiles`

Update iOS:
- replace `savePrompts`
- remove prompt-specific backend coupling

### Phase 3: Profile photos

Build:
- Storage bucket
- RLS storage policies
- photo path persistence in `profiles`

Update iOS:
- replace `uploadProfilePhoto`
- switch media resolution to Supabase paths/signed URLs

### Phase 4: Discovery, swipes, and matches

Build:
- `swipes`
- `matches`
- secure SQL view or RPC for discoverable profiles
- logic for reciprocal likes creating matches

Update iOS:
- replace `getProfiles`
- replace `likeUser`
- replace `passUser`
- replace `getMatches`

### Phase 5: Chat and Realtime

Build:
- `messages`
- Realtime subscriptions
- match-bound message access rules

Update iOS:
- replace `getMessages`
- remove custom WebSocket connection logic
- replace `sendWSMessage`

### Phase 6: Moderation and admin access

Build:
- `reports`
- `blocks`
- role-based access using `user_roles`
- custom claims or role-enforced function path for moderators/admins

Update iOS:
- replace `reportUser`
- replace `blockUser`
- remove `adminLogin`
- replace `getReports`

### Phase 7: Experiences and privileged integrations

Build:
- Hyperbeam session Edge Function
- optional session audit table

Update iOS:
- replace `createHyperbeamSession`

## Immediate Recommendations

Do these first:

1. Create the Supabase project.
2. Implement Phase 1 schema and trigger.
3. Integrate `supabase-swift` into the app.
4. Migrate auth and profile reads/writes before touching chat.

Do not start with chat.

## Model Changes Required in Swift

The biggest contract change will be identifier type.

Current:
- `User.id` is `Int`

Target:
- `User.id` should become `UUID` or `String`

Recommendation:
- move to `UUID` in the Swift models
- do not preserve legacy integer IDs unless you have a hard external dependency

Additional changes:
- `getMessages(matchUserId:)` should become `getMessages(matchId:)`
- admin auth state should be replaced with role state
- custom API token storage should be replaced with Supabase session handling

## Suggested Repo Layout

Keep the backend definition in this same repo:

- `Intro/Intro/`
  - iOS app code
- `supabase/`
  - local Supabase project config
  - migrations
  - edge functions

This keeps your source of truth in one repo even though Supabase hosts the backend runtime.

## First Concrete Deliverables

The first deliverables added to this repo should be:

1. Initial SQL migration for auth/profile foundation
2. Supabase integration branch in `APIService.swift`
3. Replacement of login/register/profile flows

## Scope Estimate

Effort by area:

- Auth and profile: low to medium
- Prompts and photos: low to medium
- Discovery and matching: medium
- Chat and realtime: medium to high
- Moderation migration: medium

Overall:
- medium rewrite if done in stages
- high risk only if attempted as a single cutover

## Next Step

The next implementation step after this document is:

- create and review the initial SQL migration
- then wire Supabase Auth into the iOS app

---

# WORKING_RULES.md

# Intro Working Rules

## Decision

Intro will use:

- Xcode as the only source of truth for the iPhone app
- Supabase as the long-term source of truth for backend behavior

Do not treat backend changes as automatically reflected in the iPhone app.

## Non-Negotiable Rules

1. All iOS UI and client behavior changes happen in Xcode.
2. All backend changes must preserve a documented API contract.
3. Dev and production must be tested separately.
4. No production deploy is considered complete until the iPhone app is tested against it.

## What Went Wrong Before

These were the real failure patterns:

- production serving older code than development
- response wrappers changing between endpoints
- missing required fields like `id` or `age`
- different response shapes for similar endpoints
- auth depending on in-memory session state
- backend changes landing without immediate iPhone validation

These are process problems, not just code problems.

## Source Of Truth

- iOS app: this Xcode project
- backend: the live Supabase project plus repo-local migrations/functions
- API contract: explicit and documented

If a backend endpoint changes request or response shape, the contract changed.

## Backend Contract Rule

Every endpoint used by the iPhone app must have a stable response shape.

For the same concept, use the same shape everywhere.

Example:
- `GET /api/profile`
- `PUT /api/profile`
- `GET /api/profiles`

These should all return compatible user objects.

## Before Any Backend Publish

1. List the endpoints changed.
2. List the request shape changes.
3. List the response shape changes.
4. Compare dev behavior to production behavior.
5. Confirm auth/session behavior survives restart and deploy.

## After Any Backend Publish

1. Launch the iPhone app from Xcode.
2. Log in fresh.
3. Test the changed flow end to end.
4. Watch Xcode console for:
   - auth/session errors
   - decoding errors
   - storage failures
   - realtime failures
   - server errors

## Minimum Validation For Intro

Before calling a build good:

1. Login works
2. Registration works
3. Terms flow works
4. Profile edit/save works
5. Discover loads profiles
6. Pass works
7. Like works
8. Matches load
9. Chat loads and sends
10. Safety and moderation entry points behave as intended for the current demo account type

## Auth Rule

Auth may not depend on in-memory-only state in production.

Tokens and sessions must survive:

- server restart
- deploy
- scale event

If login works but protected routes return `401 Invalid token`, treat that as a backend production bug first.

## Release Rule

Do not ship based on “it worked in development.”

Ship only when:

1. production is deployed
2. the iPhone app is tested against production
3. the changed endpoints return the expected contract
4. no blocking console errors remain

## Workflow To Follow

1. Make iOS changes in Xcode.
2. Make backend changes in Supabase and record them in this repo.
3. Document contract changes immediately.
4. Apply migrations or deploy functions intentionally.
5. Re-test from Xcode on simulator and real device.
6. Only then move toward TestFlight.

## Practical Rule For Intro

If something breaks, first ask:

1. Is this a UI bug?
2. Is this a decoding/contract bug?
3. Is this a production deployment mismatch?
4. Is this an auth/session persistence bug?

That order will usually get to the answer faster than changing the iPhone app blindly.
