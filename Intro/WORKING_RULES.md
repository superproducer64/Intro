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
