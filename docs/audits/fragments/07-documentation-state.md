## 7. Documentation State

### `README.md` describes a Flutter app; the codebase is Node+Express+RN/Expo

`README.md` (last touched 2025-10-24, commit `644daeb`, "Add files via upload") opens with: "A Flutter app called Intro — a modern dating platform for introverts and homebodies to connect online through simple swiping, matching, and optional interactive virtual experiences like cafes, parties, and video chat rooms."

`replit.md` (last touched 2026-06-18, commit "Lock diagnostic page, stop email leak, fix moderation reports API") opens with: "# Intro - Connect Without Connecting ## Overview A modern dating platform for introverts. Features both a web app and a React Native/Expo mobile app (for Apple App Store), with swiping, matching, real-time messaging, virtual experiences, and safety features." Its "Project Architecture" section correctly enumerates the actual stack: static HTML/CSS/JS web frontend served by Express (`public/`), React Native/Expo mobile app (`mobile/`), Node.js/Express backend (`server.js`), PostgreSQL database, bcryptjs/token-based auth with Sign in with Apple, and WebSocket real-time messaging.

There is no Flutter code anywhere in the current repo (no `lib/main.dart`, no `pubspec.yaml`); the Flutter framing in `README.md` reflects an earlier, abandoned concept — consistent with the Flutter/IDE leftover files (`.metadata`, `intro.iml`) flagged as dead code in Task 1's fragment. `replit.md` is eight months newer than `README.md` and accurately describes the live architecture (Node/Express backend + React Native/Expo mobile app), while `README.md` is stale and misleading to anyone using it as an entry point to the project.

### `Intro/AGENTS.md` and `Intro/CLAUDE.md`

Both files live inside `Intro/`, the parallel scaffold directory that Task 1's fragment (`01-dead-code.md`) recommends removing entirely (tagged `dead-code`, not referenced by any `.replit` workflow or other file in the repo). `Intro/AGENTS.md` and `Intro/CLAUDE.md` were both added in commit `c9d09a2` (2026-06-01, "Published your App"), the same commit series that Task 1 identifies as the automated scaffold-publishing pattern; the `Intro/` directory as a whole was last touched by commit `b26063d` (2026-06-02), also cited in Task 1's fragment. No root-level `AGENTS.md`/`CLAUDE.md` exist in this repo for these two files to duplicate or conflict with — they document only the `Intro/` scaffold itself and have no independent reason to exist once that directory is removed.

### `mobile/PHOTO_VIDEO_PLAN.txt`

Already flagged in Task 4's fragment (`04-mobile-structure.md`): a 236-line implementation plan, last touched 2026-07-10, whose every specified function and UI handler is already implemented in `mobile/src/services/api.js` and `mobile/src/screens/Profile/ProfileScreen.js`. Task 4 tags it `consolidate` and recommends moving it to `docs/` (or deleting it) since it's no longer actionable and currently sits in a source directory where it could be mistaken for an active spec. See Task 4's fragment for the full analysis; not re-litigated here.

### Findings

| File/Directory | Description | Tag | Recommendation |
|---|---|---|---|
| `README.md` | Describes the project as "A Flutter app called Intro," last touched 2025-10-24. The actual, actively maintained architecture doc (`replit.md`, last touched 2026-06-18) correctly describes a Node.js/Express backend with a React Native/Expo mobile app and a static HTML/CSS/JS web frontend — no Flutter code exists anywhere in the repo. `README.md` is stale and contradicts the real codebase, misleading anyone using it as an entry point. | consolidate | Rewrite `README.md` to match `replit.md`'s architecture description (Node+Express backend, RN/Expo mobile app, static web frontend), or replace its content with a pointer to `replit.md` as the source of truth. |
| `Intro/AGENTS.md`, `Intro/CLAUDE.md` | Live inside `Intro/`, the parallel scaffold directory Task 1's fragment recommends removing entirely (unreferenced by any `.replit` workflow or other repo file). Both added in commit `c9d09a2` (2026-06-01), part of the same automated "Published your App" scaffold pattern Task 1 documents; `Intro/` as a whole was last touched by commit `b26063d` (2026-06-02). No content in either file is independent of the `Intro/` scaffold it documents. | dead-code | Remove alongside the rest of `Intro/` per Task 1's recommendation — no standalone action needed beyond that directory removal. |
| `mobile/PHOTO_VIDEO_PLAN.txt` | See Task 4's fragment (`04-mobile-structure.md`) for full analysis: a 236-line implementation plan, last touched 2026-07-10, fully implemented (every listed function/handler already exists in `services/api.js` and `ProfileScreen.js`), sitting in a source directory rather than `docs/`. | consolidate | See Task 4's fragment — move to `docs/` or delete; not repeated here. |
