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

Status: passed on real-device Supabase demo path after tightened policy pass.

### Auth

- [x] Register with email/password
- [x] Log in with email/password
- [x] Log out successfully
- [x] Relaunch app and restore session
- [x] Handle auth failure with a visible user-facing error

Notes:
- If `appleSignIn` is not finished, hide it or label it as unavailable before demo.

### Legal / Entry Flow

- [x] Terms / EULA flow appears when expected
- [x] User can continue through the expected entry path

### Profile Setup

- [x] Complete profile setup
- [x] Save prompts successfully
- [x] Choose avatar successfully
- [x] Add profile photo successfully
- [x] Finish setup without app state drift after relaunch

### Profile / Appearance

- [x] Load profile screen successfully
- [x] Remote photo renders when available
- [x] Local fallback photo renders when remote photo is unavailable
- [x] Avatar fallback renders when no photo exists
- [x] Edit appearance and save avatar selection
- [x] Upload replacement photo from profile screen
- [x] Use avatar-only mode and confirm photo removal does not drift

### Discover

- [x] Discover screen loads profiles
- [x] Pass action works
- [x] Like action works
- [x] Refresh loads additional profiles or shows stable empty state
- [x] Profile images render or degrade gracefully

### Matches

- [x] Matches screen loads
- [x] Match cards render stable data
- [x] Match photo renders or degrades gracefully
- [x] Tap into chat from match card

### Chat

- [x] Chat history loads
- [x] Send message works
- [x] Incoming message appears within acceptable demo delay
- [x] Reopen chat without broken state
- [x] Relaunch app and reopen chat successfully

Notes:
- Current polling fallback is acceptable for demo if it is stable and clearly not broken.

### Moderation

- [x] Report user action works
- [x] Block user action works
- [x] Blocked user no longer appears where expected
- [ ] Moderator-role account can open reports if moderation is part of demo

### Settings / Navigation

- [x] Main tab navigation is stable
- [x] Settings screen opens
- [x] Profile -> Settings path works
- [x] Any visible demo navigation targets are functional

## Hide Before Demo

- [x] Hide Hyperbeam or any dropped experience entry points
- [x] Hide unfinished Sign in with Apple if not completed
- [x] Hide any button that leads to known broken flow
- [x] Remove or hide any admin-only entry point from non-admin demo accounts

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
