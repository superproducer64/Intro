# Demo User Tracker

Purpose: keep the current test and demo users organized so account state does not become confusing during repeated testing.

## How To Use

- one row per account
- update the status after major testing actions
- keep the real passwords only in your private notes if needed

## Tracker

| Label | Email | Role | Device | Has Photo | Has Discover Profiles | Matched With | Blocked Anyone | Was Blocked | Moderation Access | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Demo Primary |  | primary |  | Yes / No | Yes / No |  | Yes / No | Yes / No | Yes / No |  |
| Demo Match |  | match |  | Yes / No | Yes / No |  | Yes / No | Yes / No | Yes / No |  |
| Demo Safety |  | safety |  | Yes / No | Yes / No |  | Yes / No | Yes / No | Yes / No |  |
| Demo Backup |  | backup |  | Yes / No | Yes / No |  | Yes / No | Yes / No | Yes / No |  |
| Test User 5 |  | test |  | Yes / No | Yes / No |  | Yes / No | Yes / No | Yes / No |  |
| Test User 6 |  | test |  | Yes / No | Yes / No |  | Yes / No | Yes / No | Yes / No |  |
| Test User 7 |  | test |  | Yes / No | Yes / No |  | Yes / No | Yes / No | Yes / No |  |
| Test User 8 |  | test |  | Yes / No | Yes / No |  | Yes / No | Yes / No | Yes / No |  |
| Test User 9 |  | test |  | Yes / No | Yes / No |  | Yes / No | Yes / No | Yes / No |  |
| Test User 10 |  | test |  | Yes / No | Yes / No |  | Yes / No | Yes / No | Yes / No |  |

## Recommended Conventions

- `primary`
  Use for the main walkthrough only.

- `match`
  Keep matched with `primary` and avoid extra swipes.

- `safety`
  Use for report/block testing only.

- `backup`
  Keep clean and unused until needed.

- `test`
  Use for general experimentation and destructive testing.

## Quick Notes

- If an account shows `No More Profiles`, mark `Has Discover Profiles = No`.
- If an account was used in report/block testing, update the block columns immediately.
- If photos are uploaded but not visible cross-device, mark `Has Photo = Yes` and note whether the issue is local-only or remote visibility.
