# Intro TestFlight Handoff Checklist

Purpose: send a stable Supabase-backed build to an external tester and validate remote chat.

## Current Build Requirements

- Use the latest build only.
- Supabase backend mode must be active.
- Apple Sign In remains out of scope unless explicitly enabled later.
- Admin/moderator access should be assigned through `public.user_roles`, not through client-only behavior.

## Before Upload

1. Build the project successfully in Xcode.
2. Confirm the app runs on a physical iPhone.
3. Confirm `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_STORAGE_BUCKET`, and `BACKEND_MODE` are set for the build configuration being archived.
4. Confirm Supabase RLS and Storage policies are tightened and still pass the app flow.
5. Increment the build number in Xcode.
6. Keep the `service_role` key out of the app.

## App Store Connect Upload

1. In Xcode, choose a generic iOS device or connected device target.
2. Select `Product > Archive`.
3. When Organizer opens, validate the archive if needed.
4. Upload the archive to App Store Connect.
5. Wait for processing to finish.

## External Tester Setup

1. In App Store Connect, open the app.
2. Go to TestFlight.
3. Add the tester email to an external tester group.
4. Submit the build for Beta App Review if required.
5. After approval, send the tester invite.
6. Tester installs TestFlight from the App Store and accepts the invite.

## Remote Chat Test

Use two current accounts on the same latest TestFlight build.

1. Tester registers or signs in.
2. Tester completes profile setup.
3. Tester uploads a photo.
4. You sign in with a separate current account.
5. Confirm both profiles appear in Discover.
6. Like both directions to create a match.
7. Confirm Matches appears on both accounts.
8. Send message from tester to you.
9. Send message from you to tester.
10. Force close and reopen both apps.
11. Confirm match and chat history persist.

## Safety Test

1. Submit one report from a normal account.
2. Confirm the report appears in Supabase `reports`.
3. Block a user.
4. Confirm the blocked relationship appears in Supabase `blocks`.
5. Confirm blocked users disappear from expected app surfaces.

## Known TestFlight Caveats

- Chat currently uses polling fallback rather than final realtime.
- Sign in with Apple is not part of this TestFlight pass.
- Admin/moderator profile streamlining is deferred until production hardening.

## Pass Criteria

Call the TestFlight handoff ready when:

1. the build installs from TestFlight
2. registration/login works
3. photos upload and render after relaunch
4. discover and matching work
5. chat works across remote devices
6. reports and blocks persist in Supabase
