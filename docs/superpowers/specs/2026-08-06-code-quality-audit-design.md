# Intro — Code Quality & Architecture Audit

## Purpose

A code quality and architecture audit of the Intro repo (dating app: Node/Express + PostgreSQL backend, React Native/Expo mobile app, legacy static web frontend). This is a findings-report engagement: issues are identified and documented with recommendations, but no cleanup or code changes are performed as part of this work.

## Trigger

General cleanup before continuing development. The repo has accumulated structure from multiple build phases and the user wants a clear picture of what's live vs. dead weight before adding more features.

## Scope

**In scope — whole repo:**
- Backend: `server.js` and the flat `*.js` modules at repo root (`auth.js`, `db.js`, `match.js`, `message.js`, `middleware.js`, `safety.js`, `reports.js`, `cafe.js`, `cron.js`, `websocket.js`, `check-stranded.js`, `migrate.js`, `admin.js`, `profile.js`)
- Web frontend: `public/`
- Mobile app: `mobile/` (React Native/Expo, the current active mobile client)
- Legacy/parallel app trees: `Intro/` and `app/`
- Supabase: `supabase/functions/create-video-call`
- Documentation: `README.md`, `replit.md`, `Intro/AGENTS.md`, `Intro/CLAUDE.md`, `mobile/PHOTO_VIDEO_PLAN.txt`

**Out of scope:**
- Security review (auth correctness, injection risk, access control) — a separate audit type, not covered here
- Any code changes, deletions, or refactoring — findings only

## Methodology

**Approach: map live-vs-dead first, then assess quality only within what's confirmed live.**

Live/dead status is determined using three signals:
1. `.replit` workflow configuration — which entry points actually run (`node server.js`, `cd mobile && npx expo start`)
2. Git commit recency per directory — `git log -1 -- <path>` to see when each tree was last meaningfully touched
3. A spot-check for cross-references — confirming nothing in the live trees imports from or depends on code in a tree flagged as dead

Initial signal already gathered during scoping:
- `Intro/` — last touched June 2, 2026, via an automated "Published your App" commit (not real development)
- `app/` — last touched June 1, 2026, same automated commit pattern
- `mobile/` — actively touched, most recent commit August 3, 2026
- `public/` — last real commit July 3, 2026; status (actively maintained vs. drifting) needs closer review during the audit itself

Once live/dead status is settled, quality review (file size/complexity, separation of concerns, duplication, naming/structure consistency) is applied only to code confirmed live. Dead code is flagged for removal but not quality-graded — grading unused code isn't actionable.

This is lighter-weight than full import-graph tracing from every entry point, which was considered and rejected as overkill for a repo this size given how strong the recency + workflow-config signal already is.

## Audit Categories

1. **Dead/abandoned code** — confirm `Intro/` and `app/` status as abandoned; check for any stray references from live code (backend, `mobile/`, `public/`) before concluding they're safe to remove.
2. **Web frontend status** (`public/`) — determine whether it's still actively maintained alongside `mobile/` or trending toward abandonment; note any feature duplication between the web and mobile clients.
3. **Backend structure** — assess whether `server.js` and the flat `*.js` files at root have reasonable separation of concerns (routing vs. business logic vs. data access), flag files that have grown too large or mixed multiple responsibilities, check naming consistency.
4. **Mobile app structure** (`mobile/src/`) — review organization consistency across `components/`, `constants/`, `navigation/`, `screens/`, `services/`, `utils/`; flag screen files that have grown too large; flag planning documents (e.g. `PHOTO_VIDEO_PLAN.txt`) that belong in `docs/` rather than mixed into source.
5. **Supabase edge function** (`create-video-call`) — assess whether this is cleanly integrated with the Node backend's video-call flow or is an orphaned/parallel data path.
6. **Stack consistency** — `Intro/` and `app/` are TypeScript; the backend and `mobile/` are plain JavaScript. If anything from the TypeScript trees is worth keeping, flag the stack split as a decision point rather than quietly resolving it.
7. **Documentation state** — `README.md`, `replit.md`, and `Intro/`'s own `AGENTS.md`/`CLAUDE.md` overlap in purpose. Flag which documents are current and authoritative vs. stale and safe to remove or consolidate.

## Deliverable

A single findings report (markdown). Each finding is organized by tree/module and tagged with one of: **dead-code**, **consolidate**, **restructure**, or **stylistic**. Each finding includes:
- File/directory reference
- Description of the issue
- Tag (dead-code / consolidate / restructure / stylistic)
- Recommendation

No changes are applied as part of this engagement — the report is handed back for the user to triage and act on.
