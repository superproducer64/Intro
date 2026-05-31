# Intro Release Checklist

Use this before:

- testing on a physical iPhone
- sending a build to someone else
- preparing for TestFlight

## Backend

1. Confirm the Supabase project URL and environment are correct. Status: passed for current demo project.
2. Confirm any recent schema, policy, storage, or function changes were reviewed against `BACKEND_SYNC.md`. Status: tightened Supabase RLS/storage policies passed real-device demo flow.
3. Confirm request and response shapes still match the iOS app for any legacy endpoints still in use.
4. Confirm the active flow is using the intended backend path: Supabase, legacy backend, or mixed-mode by design. Status: Supabase path active for auth/profile/photos/discover/matches/chat/moderation.
5. Confirm no privileged Supabase secret is present in the iOS app. Status: app uses public anon/publishable key only.

## Build

1. Build the Xcode project successfully.
2. Resolve any Xcode warnings or errors that affect the changed flow.
3. Confirm signing is valid for the selected Apple team.
4. Confirm the target device is correct.

## Core App Flow

1. Launch the app from Xcode on a real iPhone. Status: passed.
2. Confirm login works. Status: passed.
3. Confirm registration works. Status: passed.
4. Confirm Terms/EULA flow works.
5. Confirm profile setup works. Status: passed with photos and prompts.
6. Confirm tab navigation works. Status: passed.
7. Confirm session restore works after app relaunch. Status: passed.

## Discover And Matches

1. Confirm profiles load in Discover. Status: passed.
2. Confirm pass action works. Status: passed.
3. Confirm like action works. Status: passed.
4. Confirm match creation works when test data is available. Status: passed.

## Messaging

1. Test with two accounts on two devices if messaging changed. Status: passed.
2. Confirm chat history loads. Status: passed.
3. Confirm send works both directions. Status: passed.
4. Confirm reopen works after backgrounding and reopening. Status: passed.
5. Confirm the polling fallback still presents a stable chat experience if Realtime is not active. Status: passed.
6. Check the Xcode console for WebSocket auth, receive, or send errors.

## Moderation And Safety

1. Confirm the Safety Center is reachable from Settings.
2. Confirm report and block actions are available from profile moderation entry points. Status: passed.
3. Confirm blocked users no longer appear in the expected user-facing flows. Status: passed.
4. Confirm moderation reports are only reachable for moderator or admin accounts.

## Notifications And Native Capabilities

1. Confirm notification permission prompt appears when expected.
2. Confirm APNs token is captured on a physical device.
3. Confirm any native capability changes were tested on hardware, not just simulator.
4. Confirm Sign in with Apple is configured if that flow is expected to work.

## Supabase Security Checks

1. Confirm RLS is enabled on newly used user-facing tables. Status: passed after tightened policy pass.
2. Confirm a normal user cannot access moderator/admin-only data.
3. Confirm profile photo storage rules match the intended privacy model. Status: passed with lowercase UUID object paths.
4. Confirm the app is using the public `anon` key only. Status: passed.

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
