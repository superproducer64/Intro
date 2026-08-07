## 2. Web Frontend Status (public/)

### Summary

`public/` is still actively served by the backend (`server.js:20`, `app.use(express.static('public'));`), and it is not a single stale page — it is **two functionally different static frontends living side by side**, plus two orphaned duplicate files left over from before the second one was split out. One of the two frontends (`public/preview-b/`) received real, feature-driven development as recently as 2026-07-03; the other (`public/index.html`, the one actually served at the site root) is a locked-down diagnostic/API-tester page last touched 2026-06-18. Neither page is linked to the other, so there is no evidence either was deliberately chosen as "the" web frontend — this is a genuine duplication that needs an explicit decision, not a dead-code cleanup.

### Evidence

**Recency (`git log -5 --oneline -- public/`):**
```
074f14b 2026-07-03 Bite 5: café Launch button routing + auth fixed (Hyperbeam call wired, live trigger deferred)
020cb11 2026-07-03 Bite 4: chat restored — history + live WebSocket working (verified two-user test)
fda0834 2026-07-02 Bite 3: matches fetch fixed (real profiles in swipe deck)
2ce3439 2026-07-02 Preview-B restored + CSP button rewire (Bites 1-2)
06a0a45 2026-06-18 Lock diagnostic web page + stop leaking emails in match feed
```
All five of the most recent `public/` commits (verified with `git log --oneline -- public/preview-b/`) touch `public/preview-b/` specifically, except `06a0a45`, which touches the root `public/index.html`. For comparison, `mobile/` has commits through 2026-08-06 (the day before this audit), so the web frontend as a whole has been quiet for roughly five weeks relative to mobile, but `public/preview-b/` was the subject of a coherent, apparently-completed five-commit "Bites 1-5" restoration effort, not abandonment mid-stream.

**`server.js:20`:** `app.use(express.static('public'));` — confirms `public/` (including `public/preview-b/`) is actively served, not dead.

**Two independent, unlinked entry points:**
- `public/index.html` (served at site root) — password-gated "Restricted... This testing page is private" diagnostic page (see `index.html:44-52`). Loads `public/app-auth.js` (`index.html:89`, `<script src="/app-auth.js">`). Its "app" is a bare API tester: sign in, a "Show Thoughtful Matches" button that dumps raw JSON (`app-auth.js:77-98`), and buttons to create café/movie/game rooms (`app-auth.js:100-131`). No swipe UI, no chat, no video call UI, no profile/settings screens.
- `public/preview-b/index.html` + `public/preview-b/app.js` + `public/preview-b/styles.css` — a much fuller app (34KB `app.js`, titled "Intro - Connect Without Connecting"), with a real bottom nav (`preview-b/index.html:465-479`) whose tabs are `data-tab="discover"`, `data-tab="matches"`, `data-tab="experiences"`, `data-tab="profile"` — i.e., it mirrors four of the mobile app's screen names directly. It also wires a Hyperbeam video-call iframe (`preview-b/app.js:663-664, 743`) into the café/movie/game "Experiences" rooms.
- Nothing in the repo links the two together: `grep -rn "preview-b"` across `public/*.html`, `public/*.js`, and `server.js` returns no matches. A visitor to the site root never sees `preview-b`; a visitor who somehow finds `/preview-b/index.html` never sees the admin gate. There is no redirect or route deciding which is canonical.

**Mobile feature-parity comparison** (`mobile/src/screens/`: `Auth`, `Chat`, `Discover`, `Experiences`, `Legal`, `Matches`, `Profile`, `Settings`, `VideoCall`):

| Mobile screen | `public/index.html` (root) | `public/preview-b/` |
|---|---|---|
| Auth | Yes — login/signup, password-gated first | Yes — login/signup |
| Discover | No (only a "show matches" JSON dump) | Yes — nav tab `discover`, swipe deck with real profile fetch (`loadProfiles`, `preview-b/app.js:432-449`) |
| Matches | Partial (raw JSON dump only) | Yes — nav tab `matches`, 56 "match" mentions in `preview-b/app.js` |
| Chat | No | Yes — commit `020cb11` "chat restored — history + live WebSocket working" |
| Experiences (café) | Partial — buttons to create cafe/movie/game rooms, no room UI | Yes — nav tab `experiences`, café/movie/game rooms with Hyperbeam call embed |
| Profile | No | Partial — profile-type/profile-data fields exist (`preview-b/app.js:142-312`) but nav tab `profile` content wasn't inspected beyond field wiring |
| Settings | No | No — zero "settings" matches in either `app.js` or either `index.html` |
| VideoCall | No | Partial — Hyperbeam iframe wired per commit `074f14b`, but that same commit message notes "live trigger deferred," i.e., not fully working |
| Legal | No | No nav link — `tos.html` exists at `public/tos.html` but is not referenced from `preview-b/index.html` or any nav |

**Orphaned duplicate files at the top level of `public/`** (not part of either live page):
- `public/app.js` (925 lines) — not referenced by `src=` in any `.html` file under `public/` (`grep -rn "app.js" public/*.html public/preview-b/*.html` only finds `preview-b/index.html`'s own relative `./app.js`, i.e. `preview-b/app.js`). It is a near-duplicate of `public/preview-b/app.js` (964 lines): a `diff` shows `preview-b/app.js` is identical except for one added block (a CSP-driven `data-action` click-delegation handler, `preview-b/app.js:370-406`) and a few small refactors. This is an unreferenced, stale predecessor of `preview-b/app.js`.
- `public/styles.css` — byte-for-byte identical to `public/preview-b/styles.css` (`diff public/styles.css public/preview-b/styles.css` produces no output). Not referenced by any top-level HTML file (`grep -rn "styles.css" public/*.html` returns nothing); only `preview-b/index.html:8` references it, and via its own relative copy.

**Non-frontend files also sitting in the statically-served `public/`:** `get-files.html`, `intro-build.command`, `intro-ios.tar.gz`, `mobile-build.tar.gz`, and `setup-creds.sh` are developer/build utilities (an iOS Xcode project tarball, a build installer script, an EAS credentials-setup shell script) rather than web-frontend content, but because `server.js:20` serves the whole `public/` directory statically, they are all publicly downloadable at their URL paths (e.g. `/intro-ios.tar.gz`, `/setup-creds.sh`) with no authentication. `setup-creds.sh` does not contain hardcoded passwords/tokens (checked for `password|token|secret|key`; only a `read -p`-style prompt instruction and the developer's own Apple ID email appear), so this isn't a credential leak, but it is dev tooling exposed on the public web server.

### Findings

| # | File/Directory | Description | Tag | Recommendation |
|---|---|---|---|---|
| 1 | `public/index.html` vs. `public/preview-b/` | Two independent, unlinked static web frontends are both live (served by `server.js:20`). The root page (`index.html`) is a password-gated diagnostic API tester with no real feature parity to mobile; `public/preview-b/` is a fuller prototype with partial parity to 4 of mobile's 9 screens (Discover, Matches, Chat, Experiences), actively developed as recently as 2026-07-03 via a coherent "Bites 1-5" effort, but not linked from the root and missing Settings, Legal, and a fully working VideoCall trigger. No code or config in the repo indicates which one is meant to be canonical. | consolidate | Decide explicitly which page (if either) is the intended public web frontend, then either link/promote `preview-b` to the site root and retire the diagnostic tester (or move it behind a real admin route), or document that `preview-b` is throwaway/experimental and can be dropped. Either decision resolves the ambiguity; leaving both live indefinitely risks confusing future contributors about which file to edit. |
| 2 | `public/app.js`, `public/styles.css` | Both files sit at the top level of `public/` but are not referenced (`src=`/`href=`) by any HTML file there. `app.js` is a stale, near-identical predecessor of `public/preview-b/app.js` (missing one CSP click-delegation fix); `styles.css` is byte-identical to `public/preview-b/styles.css`. Both are leftovers from before `preview-b` was split into its own subdirectory. | dead-code | Delete the two orphaned top-level files once someone confirms nothing external references them by a hardcoded absolute path (e.g. a bookmark or a build step); they are superseded by the copies inside `public/preview-b/`. |
| 3 | `public/get-files.html`, `public/intro-build.command`, `public/intro-ios.tar.gz`, `public/mobile-build.tar.gz`, `public/setup-creds.sh` | Developer/build utilities (iOS Xcode project archive, installer script, EAS credential-setup script) live inside the statically-served `public/` directory, making them publicly downloadable with no auth via `express.static('public')` (`server.js:20`). No hardcoded secrets were found in `setup-creds.sh`, so this is not a credential leak, but it is unrelated dev tooling exposed on the production web server alongside the actual frontend. | restructure | Move these files out of `public/` (e.g. into a `scripts/` or `dist/` path that isn't statically served, or behind the existing admin auth) so the public web root only contains the actual frontend. |

### What this is *not*

This is not a "public/ is dead, remove it" finding. `server.js` actively serves it, and `public/preview-b/` shows real, recent, feature-driven commits bringing it toward parity with several mobile screens. The issue is fragmentation (two unlinked frontends) and two small orphaned files, not abandonment.
