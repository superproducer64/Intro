# Intro Markdown Index

Purpose: provide one master list of the project markdown documents for review, handoff, or download.

## Documents

1. `BACKEND_SYNC.md`
   Backend contract and sync guide between the iOS app and backend behavior, including implementation expectations for reporting, blocking, and profile photo handling.

2. `DEMO_READINESS_CHECKLIST.md`
   Demo-focused testing checklist covering auth, profile setup, discover, matches, chat, moderation, navigation, and demo-blocking criteria.

3. `DEMO_ACCOUNT_MATRIX.md`
   Role-based plan for keeping a stable set of demo accounts for discover, chat, safety, and backup use.

4. `DEMO_USER_TRACKER.md`
   Fill-in tracker for test and demo account state, including discover readiness, photos, matches, and moderation access.

5. `PROGRESS_NOTES.md`
   Short historical status snapshot of the app migration work and early follow-up items.

6. `RELEASE_CHECKLIST.md`
   Pre-release and device testing checklist for backend validation, build integrity, messaging, native capabilities, and TestFlight readiness.

7. `SECURITY_REVIEW_REPORT.md`
   Client-side security and privacy review with findings, risks, and recommended remediation order.

8. `SUPABASE_CUTOVER_CHECKLIST.md`
   Operational checklist for safely moving the app from the legacy backend to Supabase with rollback and validation discipline.

9. `SUPABASE_MIGRATION_PLAN.md`
   Staged migration plan mapping existing app features and `APIService.swift` surfaces onto Supabase services and phases.

10. `SUPABASE_PHOTO_STORAGE_SETUP.md`
   Storage setup guide for making uploaded profile photos visible across devices and other users during demo/testing.

11. `TESTFLIGHT_HANDOFF_CHECKLIST.md`
   Checklist for uploading the latest Supabase-backed build to TestFlight and validating remote chat with an external tester.

12. `WORKING_RULES.md`
   Project operating rules for source-of-truth decisions, backend contract discipline, validation expectations, and release process.

## File Count

- Total markdown files: `12`

## Current Notes

- `Hyperbeam` and dropped experiences are no longer part of the intended demo surface, but some older documents may still reference that flow.
- This index is meant to make document export easier; it does not replace the source files themselves.
