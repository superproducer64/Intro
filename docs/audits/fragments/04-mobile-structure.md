## 4. Mobile App Structure

Scope: `mobile/src/` (`components/`, `constants/`, `navigation/`, `screens/`, `services/`, `utils/`) and `mobile/PHOTO_VIDEO_PLAN.txt`.

### Screen line counts (`find mobile/src/screens -name "*.js" | xargs wc -l | sort -n`)

| Screen | Lines |
|---|---|
| `Legal/PrivacyPolicyScreen.js` | 51 |
| `Experiences/ExperiencesScreen.js` | 95 |
| `Matches/MatchesScreen.js` | 124 |
| `Profile/ViewProfileScreen.js` | 141 |
| `Legal/TermsOfServiceScreen.js` | 147 |
| `Settings/SettingsScreen.js` | 148 |
| `Auth/LoginScreen.js` | 157 |
| `Discover/DiscoverScreen.js` | 175 |
| `VideoCall/VideoCallScreen.js` | 243 |
| `Profile/ProfileSetupScreen.js` | 245 |
| `Experiences/CafeRoomScreen.js` | 247 |
| `Auth/RegisterScreen.js` | 272 |
| `Chat/ChatScreen.js` | 285 |
| `Profile/ProfileScreen.js` | 561 |

`Profile/ProfileScreen.js` (561 lines) is roughly double the next-largest screen (`Chat/ChatScreen.js`, 285) and nearly 5x the median. Reading the file (`mobile/src/screens/Profile/ProfileScreen.js`), it combines three fairly distinct concerns in one component: (1) the profile edit form (name/age/bio/location/personality/prompts — `handleSave` at line 74), (2) photo-gallery management (`handleAddPhotos` line 133, `handleDeletePhoto` line 166, `handleReorderPhotos` line 184), and (3) video upload/delete (`handleAddVideo` line 194, `handleDeleteVideo` line 238), plus the view/display rendering for all three. No other screen mixes this many concerns — e.g. `ProfileSetupScreen.js` (245 lines) handles only the initial onboarding form, and `ViewProfileScreen.js` (141 lines) handles only read-only display of another user's profile.

### Subdirectory organization consistency (`find mobile/src -maxdepth 2 -type f -name "*.js" | sort`)

```
mobile/src/components/GuidelinesGate.js       (73 lines)
mobile/src/components/InlineVideoPlayer.js    (49 lines)
mobile/src/components/ReportBlockModal.js     (197 lines)
mobile/src/constants/theme.js                 (54 lines)
mobile/src/navigation/AppNavigator.js         (137 lines)
mobile/src/services/api.js                    (990 lines)
mobile/src/services/supabase.js               (32 lines)
mobile/src/utils/conversationStarters.js      (113 lines)
mobile/src/utils/notificationSound.js         (17 lines)
```
(`screens/` is organized separately, by feature subdirectory — `Auth/`, `Chat/`, `Discover/`, `Experiences/`, `Legal/`, `Matches/`, `Profile/`, `Settings/`, `VideoCall/` — one file per screen; this is internally consistent and not flagged.)

`components/` (3 files) and `utils/` (2 files) each follow a one-file-per-concern pattern. `constants/theme.js` and `navigation/AppNavigator.js` are legitimately single files (one coherent theme config, one coherent navigator tree) — not catch-alls, just single-purpose modules. `services/`, however, is inconsistent internally: `services/supabase.js` (32 lines) is a focused single-purpose client-init module, but `services/api.js` is a 990-line catch-all covering unrelated concerns — auth (`initAuth`, `register`, `login`, `logout`, `appleSignIn`, `deleteAccount`), profiles (`getProfiles`, `getProfile`, `updateProfile`, `savePrompts`), matching (`likeUser`, `passUser`, `getMatches`, `unmatch`), café rooms (`getOrCreateCafeRoom`, `joinCafeRoom`, `leaveCafeRoom`, `getCafeMessages`, `sendCafeMessage`, `subscribeToCafeRoom`), video calls (`createVideoCall`, `declineVideoCall`, `endVideoCall`, `subscribeToVideoCalls`), messaging (`getMessages`, `sendMessage`, `subscribeToMessages`, unread-count tracking), safety (`reportUser`, `blockUser`), and photo/video upload (`uploadPhoto`, `deletePhoto`, `reorderPhotos`, `uploadVideo`, `deleteVideo`) — 56 exported functions/consts total (verified via `grep -c "^export "` on `mobile/src/services/api.js`). This mirrors the same "single monolithic file with many unrelated concerns" pattern flagged for the backend's `db.js` in Task 3's fragment, but on the client side.

### `PHOTO_VIDEO_PLAN.txt` placement

`mobile/PHOTO_VIDEO_PLAN.txt` (236 lines) is a plain-text implementation plan: "IMPLEMENTATION PLAN — Photo Gallery (6 max, drag-reorder) + Video Upload (30s cap)", listing every file to change (`package.json`, `src/services/api.js`, presumably `ProfileScreen.js`), new dependencies to add, and a "SUGGESTED BUILD ORDER" (install packages → add `api.js` joins/functions → build `ProfileScreen.js` UI → manual test → bump build number). Last touched per `git log -1 --format="%ad" -- mobile/PHOTO_VIDEO_PLAN.txt`: `Fri Jul 10 17:29:24 2026 -0500` (2026-07-10).

The plan is not merely stale but appears fully implemented: every function it calls for — `uploadPhoto`, `deletePhoto`, `reorderPhotos`, `getProfilePhotos` (photo gallery), `uploadVideo`, `deleteVideo` (video upload) — already exists in `mobile/src/services/api.js` (confirmed via the `grep -n "^export"` listing above, e.g. `uploadPhoto` at line 844, `reorderPhotos` at line 900, `uploadVideo` at line 947, `deleteVideo` at line 980), and `ProfileScreen.js` already contains the corresponding UI handlers (`handleAddPhotos`, `handleDeletePhoto`, `handleReorderPhotos`, `handleAddVideo`, `handleDeleteVideo`, cited above). A repo-wide search (`grep -rn "PHOTO_VIDEO_PLAN"` across `*.js`/`*.json`/`*.md`/`*.yml`/`*.yaml`, excluding `node_modules`) found no reference to this file from any code, config, or build tooling — the only hits are this audit's own planning documents. It is a historical, no-longer-actionable planning note sitting in `mobile/` (a source directory) rather than in `docs/`.

### Findings

| File/Directory | Description | Tag | Recommendation |
|---|---|---|---|
| `mobile/src/screens/Profile/ProfileScreen.js` | 561 lines — roughly 2x the next-largest screen (`Chat/ChatScreen.js`, 285 lines) and ~5x the 14-screen median. Mixes three distinct concerns in one component: profile-field editing (`handleSave`), photo-gallery management (`handleAddPhotos`/`handleDeletePhoto`/`handleReorderPhotos`), and video upload/delete (`handleAddVideo`/`handleDeleteVideo`), plus all associated view rendering. | restructure | Split into smaller pieces along the existing concern boundaries, e.g. extract the photo-gallery grid/upload UI and the video section into their own components (consistent with the `components/` directory already holding `InlineVideoPlayer.js`), leaving `ProfileScreen.js` to orchestrate the edit form plus those sub-components. |
| `mobile/src/services/api.js` | 990 lines, the largest file in `mobile/src/` by a wide margin (next-largest non-screen file is `ReportBlockModal.js` at 197 lines). Exports 56 functions/consts spanning auth, profiles, matching, café rooms, video calls, messaging, safety (report/block), and photo/video upload — unrelated concerns in one module, unlike `components/` and `utils/`, which are each split one-file-per-concern. Same pattern already flagged for the backend's `db.js` in the Task 3 fragment. | restructure | Split by concern into separate modules under `services/` (e.g. `services/auth.js`, `services/matches.js`, `services/cafe.js`, `services/messages.js`, `services/media.js`), following the same one-file-per-concern convention already used in `components/` and `utils/`. Not urgent — the file has no reported bugs — but it will only keep growing under the current pattern. |
| `mobile/PHOTO_VIDEO_PLAN.txt` | 236-line implementation plan for the photo-gallery/video-upload feature, last touched 2026-07-10. Every function and UI handler it specifies already exists in `services/api.js` and `ProfileScreen.js` (verified above), so the plan is fully implemented and no longer actionable. No code, config, or build tooling references this file (repo-wide grep found only this audit's own planning docs). It is a stale planning document sitting in a source directory (`mobile/`) rather than `docs/`. | consolidate | Move to `docs/` (e.g. `docs/planning/` or an archive location) if kept for historical reference, or delete if the plan's content isn't otherwise useful; either way it shouldn't remain in `mobile/` where it could be mistaken for an active spec. |
