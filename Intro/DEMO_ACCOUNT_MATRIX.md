# Intro Demo Account Matrix

Purpose: keep a small set of stable demo accounts with known roles so the live walkthrough stays predictable.

## Account Roles

1. `Demo Primary`
   Main walkthrough account.
   Use this to show login, discover, matches, profile, settings, and the general app experience.

2. `Demo Match`
   Matched chat partner for `Demo Primary`.
   Use this account only to support fast chat and match demonstrations.

3. `Demo Safety`
   Safety and moderation target account.
   Use this to demonstrate report and block without damaging the main match/chat demo path.

4. `Demo Backup`
   Clean fallback account.
   Use this if discover is exhausted, a test account gets blocked, or session state becomes noisy.

## Suggested State

- `Demo Primary`
  - profile complete
  - has discover candidates available
  - already matched with `Demo Match`
  - not blocked by anyone in the demo set

- `Demo Match`
  - profile complete
  - already matched with `Demo Primary`
  - active chat history available

- `Demo Safety`
  - profile complete
  - visible to `Demo Primary` through discover or another reachable path
  - safe to report and block during demo testing

- `Demo Backup`
  - profile complete
  - minimal swipe/block history
  - not used for general experimentation

## Fill-In Table

| Role | Email | Password | Discover Ready | Matched With | Safety/Moderator Notes |
|---|---|---|---|---|---|
| Demo Primary |  |  | Yes / No |  |  |
| Demo Match |  |  | Yes / No |  |  |
| Demo Safety |  |  | Yes / No |  |  |
| Demo Backup |  |  | Yes / No |  |  |

## Recommended Demo Flow

1. Log in as `Demo Primary`
2. Show Discover
3. Show Matches
4. Open chat with `Demo Match`
5. Show Profile and Settings
6. If needed, demonstrate Safety Center
7. If needed, use `Demo Safety` for report/block
8. If discover is exhausted, switch to `Demo Backup`

## Rules

- Do not use these accounts for random testing once they are prepared for the demo.
- Use throwaway accounts for extra swipe, block, report, and onboarding testing.
- Reset or replace any demo account that has exhausted its discover pool.
- Keep one matched pair ready before any live demo.

## Pre-Demo Check

- `Demo Primary` can log in
- `Demo Primary` has discover profiles
- `Demo Primary` still has a visible match with `Demo Match`
- `Demo Match` can send and receive chat messages
- `Demo Safety` is reachable if report/block will be shown
- `Demo Backup` credentials are available if needed
