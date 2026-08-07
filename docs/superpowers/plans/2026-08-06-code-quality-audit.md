# Intro Code Quality & Architecture Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a single findings report auditing the Intro repo's live-vs-dead code, backend/mobile structure, and documentation state — no code changes.

**Architecture:** Each task investigates one audit category from the spec using concrete shell commands, writes a self-contained findings fragment, then verifies every citation in that fragment against the real file before committing it. A final task merges all fragments into one report and deletes the fragments.

**Tech Stack:** Investigation only — `git`, `grep`/ripgrep-backed search, file reads. No build tooling, no test framework (there is no code under test; the "test" per task is citation verification, not automated tests).

## Global Constraints

- Findings-report only — no code changes, deletions, or refactors (per spec: "Out of scope: Any code changes, deletions, or refactoring — findings only")
- Every finding must be tagged exactly one of: `dead-code`, `consolidate`, `restructure`, `stylistic`
- Every finding must include: file/directory reference, description, tag, recommendation
- Final deliverable is markdown at `docs/audits/2026-08-06-code-quality-audit-report.md`
- Live/dead status determined via: `.replit` workflow config + git commit recency per directory + cross-reference check (per spec methodology) — not assumption

---

## Known Ground Truth (established during brainstorming — reuse, don't re-derive)

- `.replit` workflows only run `node server.js` (Web Server) and `cd mobile && npx expo start --tunnel` (Expo Mobile). `Intro/` and `app/` are not referenced by any workflow.
- `git log -1 -- Intro/` → `Tue Jun 2 03:34:03 2026 +0000` — commit message "Published your App" (automated Replit publish, not hand-authored dev work)
- `git log -1 -- app/` → `Mon Jun 1 01:03:48 2026 +0000` — same "Published your App" pattern
- `git log -1 -- mobile/` → `Mon Aug 3 21:58:17 2026 -0500` — real feature commit, actively maintained
- `git log -1 -- public/` → `Fri Jul 3 00:44:11 2026 +0000` — real feature commit, needs closer review for current status
- A repo-wide search (`from ['"]../Intro`, `require(.*Intro`, `from ['"]../app['"]`, `from ['"]./app['"]` across `*.js/*.ts/*.tsx/*.json`, excluding `node_modules`) found **zero** references from any other code into `Intro/` or `app/`
- `app/auth.tsx` imports `../services/api` (expo-router style) and `import { router } from 'expo-router'` — this points at root-level `services/api.js`, which is a separate directory from `mobile/src/services/` (which has its own `api.js` + `supabase.js`). No backend file (`server.js`, `*.js` at root) references `./services` or `../services`.
- Root `.metadata` is a Flutter-tool-generated file (`# This file tracks properties of this Flutter project`) and `intro.iml` is a JetBrains project file — both leftovers from the original Flutter incarnation described in `README.md` ("A Flutter app called Intro"), predating the current Node+Expo architecture.
- `Intro/` is TypeScript (has `tsconfig.json`); `app/` uses `.tsx`; the backend (`server.js` + root `*.js`) and `mobile/` are plain JavaScript.

---

## Task Ordering

Tasks 1–5 are independent of each other and each other's fragments — safe to dispatch in parallel. Task 6 depends on Task 1's fragment; Task 7 depends on Task 1's and Task 4's fragments — dispatch those after their dependencies commit. Task 8 depends on all seven fragments and must run last.

---

### Task 1: Dead/Abandoned Scaffold Investigation (Intro/, app/, root services/, Flutter leftovers)

**Files:**
- Create: `docs/audits/fragments/01-dead-code.md`

**Interfaces:**
- Consumes: nothing (uses ground truth above + fresh commands below)
- Produces: `docs/audits/fragments/01-dead-code.md` containing a `## 1. Dead / Abandoned Code` section with one finding per abandoned artifact (`Intro/`, `app/`, root `services/`, `.metadata`, `intro.iml`), each with File/Directory, Description, Tag, Recommendation. Later consumed by Task 8.

- [ ] **Step 1: Confirm no additional cross-references beyond the ones already found**

Run:
```bash
cd ~/intro && grep -rn "Intro/" --include="*.js" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" . 2>/dev/null | grep -v node_modules | grep -v "^\./Intro/" | grep -v "^\./docs/superpowers/"
```
Expected: no hits from live code (backend `*.js`, `mobile/`, `public/`) — only possibly self-references inside `Intro/` itself (already excluded) or mentions in `replit.md`/`README.md` (documentation, not code — note separately if found, don't treat as a code dependency).

- [ ] **Step 2: Confirm root `services/api.js` has no backend/mobile consumer**

Run:
```bash
cd ~/intro && grep -rln "require(['\"]\./services\|require(['\"]\.\./services\|from ['\"]\./services\|from ['\"]\.\./services" server.js *.js mobile/src public 2>/dev/null
```
Expected: no output (confirms root `services/` is only consumed by `app/auth.tsx`, i.e. part of the same dead scaffold).

- [ ] **Step 3: Check for any root-level Expo/router config tying `app/` + `services/` together as a once-runnable project**

Run:
```bash
cd ~/intro && find . -maxdepth 1 -iname "app.json" -o -maxdepth 1 -iname "expo-router*" 2>/dev/null
ls -la package.json | head -1
grep -n "expo-router" package.json
```
Note whether root `package.json` lists `expo-router` as a dependency (if not, `app/auth.tsx`'s `import { router } from 'expo-router'` would fail to resolve — supports that this was never a working root-level app, just scaffold).

- [ ] **Step 4: Write the fragment**

Create `docs/audits/fragments/01-dead-code.md`:

```markdown
## 1. Dead / Abandoned Code

### `Intro/` directory
- **File/Directory:** `Intro/`
- **Description:** Full parallel TypeScript app tree (has its own `app.json`, `tsconfig.json`, `AGENTS.md`, `CLAUDE.md`, `components/`, `constants/`). Last touched 2026-06-02 via an automated "Published your App" commit — not hand-authored development. Not referenced by any `.replit` workflow. No other file in the repo imports from it. [Note any doc-only mentions found in Step 1 here, or state none found.]
- **Tag:** dead-code
- **Recommendation:** Remove. If anything inside (e.g. copy, constants) is still wanted, extract it explicitly into `mobile/` first — don't keep the directory around "just in case."

### `app/` directory
- **File/Directory:** `app/`
- **Description:** Single-file expo-router-style screen (`app/auth.tsx`) importing `../services/api` and `expo-router`. Last touched 2026-06-01 via the same automated "Published your App" commit pattern as `Intro/`. [State whether `expo-router` is present in root `package.json` per Step 3 — if absent, note the import would never have resolved, confirming this was never a working app.] Not referenced by any `.replit` workflow or any other file in the repo.
- **Tag:** dead-code
- **Recommendation:** Remove alongside `Intro/` and root `services/` — they form one abandoned scaffold.

### Root `services/` directory
- **File/Directory:** `services/api.js`
- **Description:** Only consumer found is `app/auth.tsx` (Step 2 confirmed no backend or mobile file requires it). Distinct from `mobile/src/services/` (which has its own `api.js` and `supabase.js` and is actively used).
- **Tag:** dead-code
- **Recommendation:** Remove together with `app/`.

### Flutter/IDE leftovers (`.metadata`, `intro.iml`)
- **File/Directory:** `.metadata`, `intro.iml`
- **Description:** `.metadata` is Flutter-tool-generated ("This file tracks properties of this Flutter project"); `intro.iml` is a JetBrains IDE project file. Both predate the current Node+Expo architecture — `README.md` describes the original concept as "A Flutter app called Intro," but the live app is React Native/Expo, not Flutter.
- **Tag:** dead-code
- **Recommendation:** Remove both; neither is read by any current tooling (Node backend, Expo config, or `.replit`).
```

- [ ] **Step 5: Verify each citation**

Re-open each cited path (`Intro/app.json`, `app/auth.tsx`, `services/api.js`, `.metadata`, `intro.iml`) and confirm the fragment's description matches what's actually there (existence, rough content, no misattribution).

- [ ] **Step 6: Commit**

```bash
cd ~/intro && git add docs/audits/fragments/01-dead-code.md
git commit -m "Audit: document dead/abandoned scaffold (Intro/, app/, root services/, Flutter leftovers)"
```

---

### Task 2: Web Frontend Status (public/)

**Files:**
- Create: `docs/audits/fragments/02-web-frontend.md`

**Interfaces:**
- Consumes: nothing
- Produces: `docs/audits/fragments/02-web-frontend.md` containing a `## 2. Web Frontend Status (public/)` section. Later consumed by Task 8.

- [ ] **Step 1: List contents and check recency**

Run:
```bash
cd ~/intro && ls -la public/
git log -5 --oneline -- public/
```

- [ ] **Step 2: Check for feature parity/duplication vs. mobile**

Run:
```bash
cd ~/intro && grep -rln "café\|cafe\|video call\|match" public/*.js public/*.html 2>/dev/null
```
Compare the feature list found against `mobile/src/screens/` directory names (`Discover`, `Matches`, `Chat`, `Experiences`, `Profile`, `Settings`, `VideoCall`, `Legal`) to identify which mobile features exist, partially exist, or don't exist in `public/`.

- [ ] **Step 3: Check whether `server.js` still actively serves `public/`**

Run:
```bash
cd ~/intro && grep -n "public" server.js
```

- [ ] **Step 4: Write the fragment**

Create `docs/audits/fragments/02-web-frontend.md` with a `## 2. Web Frontend Status (public/)` heading. Include one finding covering: last-real-commit date, whether `server.js` still serves it (Step 3), which mobile features it duplicates vs. lacks (Step 2), and a tag — use `consolidate` if it's a stale partial duplicate of mobile worth deciding on explicitly, or note "no finding — actively maintained, keep as-is" only if Steps 1–3 show recent parity-driven commits (do not default to a negative finding if the evidence doesn't support it).

- [ ] **Step 5: Verify citations**

Re-check every file/line referenced in the fragment against the actual file.

- [ ] **Step 6: Commit**

```bash
cd ~/intro && git add docs/audits/fragments/02-web-frontend.md
git commit -m "Audit: document web frontend (public/) status"
```

---

### Task 3: Backend Structure (server.js + root *.js modules)

**Files:**
- Create: `docs/audits/fragments/03-backend-structure.md`

**Interfaces:**
- Consumes: nothing
- Produces: `docs/audits/fragments/03-backend-structure.md` containing a `## 3. Backend Structure` section. Later consumed by Task 8.

- [ ] **Step 1: Get line counts and a one-line responsibility guess per file**

Run:
```bash
cd ~/intro && wc -l server.js auth.js db.js match.js message.js middleware.js safety.js reports.js cafe.js cron.js websocket.js check-stranded.js migrate.js admin.js profile.js | sort -n
```

- [ ] **Step 2: For each file over ~150 lines, check whether it mixes route handling, business logic, and data access**

Run (repeat per large file found in Step 1, e.g. `server.js`):
```bash
cd ~/intro && grep -n "^app\.\(get\|post\|put\|delete\)\|^router\." server.js
grep -n "SELECT\|INSERT\|UPDATE\|DELETE FROM" server.js
```
If a single file has both route definitions (`app.get`/`app.post`) and raw SQL (`SELECT`/`INSERT`), that's a routing+data-access mixing signal worth flagging.

- [ ] **Step 3: Check naming/pattern consistency across the flat file list**

Run:
```bash
cd ~/intro && head -5 auth.js db.js match.js message.js middleware.js safety.js reports.js cafe.js
```
Check whether each file consistently exports the same way (e.g. `module.exports = {...}` vs. `module.exports = function`) and whether route-registration lives in `server.js` or is spread across files.

- [ ] **Step 4: Write the fragment**

Create `docs/audits/fragments/03-backend-structure.md` with a `## 3. Backend Structure` heading. Write one finding per file (or per group of related files, e.g. `safety.js` + `reports.js` if they overlap) covering: line count, whether it mixes concerns (Step 2), naming/export consistency (Step 3), a tag (`restructure` for files mixing routing+data-access or grown oversized, `stylistic` for naming inconsistency, `consolidate` if two files overlap in responsibility), and a concrete recommendation (e.g. "extract SQL queries from `server.js` lines X-Y into `db.js`").

- [ ] **Step 5: Verify citations**

Re-check every file/line referenced against the actual file.

- [ ] **Step 6: Commit**

```bash
cd ~/intro && git add docs/audits/fragments/03-backend-structure.md
git commit -m "Audit: document backend structure findings"
```

---

### Task 4: Mobile App Structure (mobile/src/)

**Files:**
- Create: `docs/audits/fragments/04-mobile-structure.md`

**Interfaces:**
- Consumes: nothing
- Produces: `docs/audits/fragments/04-mobile-structure.md` containing a `## 4. Mobile App Structure` section. Later consumed by Task 8.

- [ ] **Step 1: Get per-screen line counts**

Run:
```bash
cd ~/intro && find mobile/src/screens -name "*.js" | xargs wc -l | sort -n
```

- [ ] **Step 2: Check organization consistency across components/constants/navigation/services/utils**

Run:
```bash
cd ~/intro && find mobile/src -maxdepth 2 -type f -name "*.js" | sort
```
Check whether each subdirectory (`components/`, `constants/`, `navigation/`, `services/`, `utils/`) follows a consistent one-file-per-concern pattern, or whether some are single catch-all files.

- [ ] **Step 3: Check `PHOTO_VIDEO_PLAN.txt` placement**

Run:
```bash
cd ~/intro && head -20 mobile/PHOTO_VIDEO_PLAN.txt
git log -1 --format="%ad" -- mobile/PHOTO_VIDEO_PLAN.txt
```
Determine if it's a planning doc (belongs in `docs/`) or something still actively referenced by code/tooling.

- [ ] **Step 4: Write the fragment**

Create `docs/audits/fragments/04-mobile-structure.md` with a `## 4. Mobile App Structure` heading. Include: findings for any screen file that's grown oversized (Step 1, flag with `restructure`), any subdirectory organization inconsistency (Step 2, flag with `stylistic` or `restructure`), and the `PHOTO_VIDEO_PLAN.txt` placement (Step 3, flag with `consolidate` — move to `docs/` — if it's a stale/planning doc mixed into source).

- [ ] **Step 5: Verify citations**

Re-check every file/line referenced against the actual file.

- [ ] **Step 6: Commit**

```bash
cd ~/intro && git add docs/audits/fragments/04-mobile-structure.md
git commit -m "Audit: document mobile app structure findings"
```

---

### Task 5: Supabase Edge Function Integration

**Files:**
- Create: `docs/audits/fragments/05-supabase-function.md`

**Interfaces:**
- Consumes: nothing
- Produces: `docs/audits/fragments/05-supabase-function.md` containing a `## 5. Supabase Edge Function Integration` section. Later consumed by Task 8.

- [ ] **Step 1: Read the function**

Run:
```bash
cd ~/intro && cat supabase/functions/create-video-call/index.ts
```

- [ ] **Step 2: Find what calls it**

Run:
```bash
cd ~/intro && grep -rln "create-video-call" server.js *.js mobile/src public 2>/dev/null
```

- [ ] **Step 3: Check whether Daily.co video-call logic exists elsewhere too (duplication check)**

Run:
```bash
cd ~/intro && grep -rln "daily\|Daily" server.js *.js mobile/src 2>/dev/null | grep -v node_modules
```

- [ ] **Step 4: Write the fragment**

Create `docs/audits/fragments/05-supabase-function.md` with a `## 5. Supabase Edge Function Integration` heading. One finding: whether the function is actively called (Step 2 — cite the exact call site if found), whether video-call logic is split between this edge function and the Node backend in a confusing way (Step 3), a tag (`consolidate` if logic is split across two backends without clear reason, or state "no finding — cleanly integrated" only if Step 2 shows a clear, single call site and Step 3 shows no duplicated logic), and a recommendation.

- [ ] **Step 5: Verify citations**

Re-check every file/line referenced against the actual file.

- [ ] **Step 6: Commit**

```bash
cd ~/intro && git add docs/audits/fragments/05-supabase-function.md
git commit -m "Audit: document Supabase edge function integration findings"
```

---

### Task 6: Stack Consistency (TypeScript vs. JavaScript)

**Files:**
- Create: `docs/audits/fragments/06-stack-consistency.md`

**Interfaces:**
- Consumes: Task 1's fragment (`docs/audits/fragments/01-dead-code.md`) — read its recommendation on `Intro/`/`app/` before writing this fragment, so this finding doesn't contradict it
- Produces: `docs/audits/fragments/06-stack-consistency.md` containing a `## 6. Stack Consistency` section. Later consumed by Task 8.

- [ ] **Step 1: Read Task 1's fragment**

Run:
```bash
cd ~/intro && cat docs/audits/fragments/01-dead-code.md
```
Confirm whether it recommends removing `Intro/` and `app/` entirely.

- [ ] **Step 2: Confirm no live TypeScript exists outside the dead trees**

Run:
```bash
cd ~/intro && find . -name "*.ts" -o -name "*.tsx" 2>/dev/null | grep -v node_modules | grep -v "^\./Intro/" | grep -v "^\./app/" | grep -v "^\./supabase/"
```
Expected: only `supabase/functions/create-video-call/index.ts` (Deno edge functions are conventionally TypeScript — this is expected, not an inconsistency) — no other TS/TSX outside `Intro/`/`app/`.

- [ ] **Step 3: Write the fragment**

Create `docs/audits/fragments/06-stack-consistency.md`:

```markdown
## 6. Stack Consistency

- **File/Directory:** `Intro/`, `app/` (TypeScript) vs. `server.js` + root `*.js` + `mobile/` (JavaScript)
- **Description:** The only TypeScript in the repo lives in the two trees Task 1 identified as dead scaffold (plus the Supabase edge function, which is conventionally TypeScript and not part of this inconsistency). [State the Step 1 outcome: if Task 1 recommends removing Intro/ and app/, this finding resolves itself — note that explicitly rather than raising it as a separate open question.] If any part of `Intro/` or `app/` is kept, the stack split (TS vs. JS) becomes a decision to make explicitly rather than something to leave ambiguous.
- **Tag:** dead-code (if Task 1's removal recommendation covers it) — otherwise `restructure`
- **Recommendation:** [If Task 1 recommends full removal: "No action needed beyond Task 1's dead-code removal — resolves this automatically." Otherwise: state which stack to standardize on and why.]
```

- [ ] **Step 4: Verify citations**

Re-check the `find` output from Step 2 is accurately reflected.

- [ ] **Step 5: Commit**

```bash
cd ~/intro && git add docs/audits/fragments/06-stack-consistency.md
git commit -m "Audit: document stack consistency findings"
```

---

### Task 7: Documentation State

**Files:**
- Create: `docs/audits/fragments/07-documentation-state.md`

**Interfaces:**
- Consumes: Task 1's fragment (`docs/audits/fragments/01-dead-code.md`) and Task 4's fragment (`docs/audits/fragments/04-mobile-structure.md`) — read both before writing Step 3 below, so this fragment cross-references rather than duplicates their findings
- Produces: `docs/audits/fragments/07-documentation-state.md` containing a `## 7. Documentation State` section. Later consumed by Task 8.

- [ ] **Step 1: Read Task 1's and Task 4's fragments**

Run:
```bash
cd ~/intro && cat docs/audits/fragments/01-dead-code.md docs/audits/fragments/04-mobile-structure.md
```
Confirm Task 1's recommendation on `Intro/` (for the `AGENTS.md`/`CLAUDE.md` finding below) and whether Task 4 already flagged `PHOTO_VIDEO_PLAN.txt`.

- [ ] **Step 2: Inventory all docs and their last-touched dates**

Run:
```bash
cd ~/intro && for f in README.md replit.md Intro/AGENTS.md Intro/CLAUDE.md mobile/PHOTO_VIDEO_PLAN.txt; do
  echo "=== $f ===";
  git log -1 --format="%ad %s" -- "$f" 2>/dev/null;
done
```

- [ ] **Step 3: Check for contradictions between docs**

Run:
```bash
cd ~/intro && head -10 README.md
head -10 replit.md
```
Compare: `README.md` describes a Flutter app; `replit.md` describes the current Node+Express+RN/Expo architecture. Confirm this contradiction directly (README is stale relative to the actual codebase).

- [ ] **Step 4: Write the fragment**

Create `docs/audits/fragments/07-documentation-state.md` with a `## 7. Documentation State` heading. Include:
- Finding on `README.md` describing a Flutter app while the codebase is Node+Express+RN/Expo (Step 3) — tag `consolidate`, recommendation: rewrite `README.md` to match `replit.md`'s architecture description, or point `README.md` at `replit.md`.
- Finding on `Intro/AGENTS.md` and `Intro/CLAUDE.md` — since Task 1 flags `Intro/` itself as dead (confirmed in Step 1), these two files are dead along with it; cross-reference Task 1's fragment rather than re-litigating. Tag `dead-code`.
- Finding on `mobile/PHOTO_VIDEO_PLAN.txt` — cross-reference Task 4's finding from Step 1 (don't duplicate; if Task 4 already flagged it, note "see Task 4 finding" here instead of repeating).

- [ ] **Step 5: Verify citations**

Re-check every file/date referenced against `git log` output and file contents.

- [ ] **Step 6: Commit**

```bash
cd ~/intro && git add docs/audits/fragments/07-documentation-state.md
git commit -m "Audit: document documentation state findings"
```

---

### Task 8: Merge Fragments into Final Report

**Files:**
- Create: `docs/audits/2026-08-06-code-quality-audit-report.md`
- Delete: `docs/audits/fragments/01-dead-code.md` through `docs/audits/fragments/07-documentation-state.md`

**Interfaces:**
- Consumes: all 7 fragment files from Tasks 1–7 (`docs/audits/fragments/01-dead-code.md` ... `07-documentation-state.md`)
- Produces: `docs/audits/2026-08-06-code-quality-audit-report.md` — the final deliverable

- [ ] **Step 1: Read all 7 fragments**

Run:
```bash
cd ~/intro && cat docs/audits/fragments/01-dead-code.md docs/audits/fragments/02-web-frontend.md docs/audits/fragments/03-backend-structure.md docs/audits/fragments/04-mobile-structure.md docs/audits/fragments/05-supabase-function.md docs/audits/fragments/06-stack-consistency.md docs/audits/fragments/07-documentation-state.md
```

- [ ] **Step 2: Check for contradictions between fragments**

Confirm Task 6 and Task 7's findings about `Intro/`/`app/` agree with Task 1's recommendation (they were written to cross-reference it — verify they actually do, not just that they were instructed to). Confirm Task 4 and Task 7's `PHOTO_VIDEO_PLAN.txt` findings don't duplicate each other.

- [ ] **Step 3: Write the final report**

Create `docs/audits/2026-08-06-code-quality-audit-report.md`:

```markdown
# Intro — Code Quality & Architecture Audit Report

**Date:** 2026-08-06
**Spec:** `docs/superpowers/specs/2026-08-06-code-quality-audit-design.md`

This report identifies dead code, structural issues, and documentation drift in the Intro repo. No changes have been made — every finding is tagged `dead-code`, `consolidate`, `restructure`, or `stylistic` with a concrete recommendation for the user to act on.

[Insert Task 1's "## 1. Dead / Abandoned Code" section verbatim]

[Insert Task 2's "## 2. Web Frontend Status (public/)" section verbatim]

[Insert Task 3's "## 3. Backend Structure" section verbatim]

[Insert Task 4's "## 4. Mobile App Structure" section verbatim]

[Insert Task 5's "## 5. Supabase Edge Function Integration" section verbatim]

[Insert Task 6's "## 6. Stack Consistency" section verbatim]

[Insert Task 7's "## 7. Documentation State" section verbatim]

## Summary

| # | Area | Tag(s) | Recommendation |
|---|------|--------|-----------------|
| 1 | Dead/abandoned code | dead-code | Remove `Intro/`, `app/`, root `services/`, `.metadata`, `intro.iml` |
| 2 | Web frontend (public/) | [fill from Task 2] | [fill from Task 2] |
| 3 | Backend structure | [fill from Task 3] | [fill from Task 3] |
| 4 | Mobile structure | [fill from Task 4] | [fill from Task 4] |
| 5 | Supabase edge function | [fill from Task 5] | [fill from Task 5] |
| 6 | Stack consistency | [fill from Task 6] | [fill from Task 6] |
| 7 | Documentation state | [fill from Task 7] | [fill from Task 7] |
```

Fill every `[Insert ...]` and `[fill from ...]` placeholder with the actual fragment content/summary — none of these bracketed markers may remain in the committed file.

- [ ] **Step 4: Remove the fragments directory**

Run:
```bash
cd ~/intro && git rm docs/audits/fragments/01-dead-code.md docs/audits/fragments/02-web-frontend.md docs/audits/fragments/03-backend-structure.md docs/audits/fragments/04-mobile-structure.md docs/audits/fragments/05-supabase-function.md docs/audits/fragments/06-stack-consistency.md docs/audits/fragments/07-documentation-state.md
rmdir docs/audits/fragments 2>/dev/null || true
```

- [ ] **Step 5: Verify the final report has no leftover bracketed placeholders**

Run:
```bash
cd ~/intro && grep -n "\[Insert\|\[fill from" docs/audits/2026-08-06-code-quality-audit-report.md
```
Expected: no output. If anything matches, go back to Step 3 and fill it in.

- [ ] **Step 6: Commit**

```bash
cd ~/intro && git add docs/audits/2026-08-06-code-quality-audit-report.md
git commit -m "Audit: merge findings into final code quality & architecture report"
```
