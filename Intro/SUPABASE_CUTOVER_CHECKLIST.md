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
