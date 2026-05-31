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
