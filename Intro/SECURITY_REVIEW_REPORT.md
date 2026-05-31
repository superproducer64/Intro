# Intro iOS App System Review

Date: April 4, 2026
Scope: iOS client code present in this repository
Build status at review time: Builds successfully

## Executive Summary

The app currently builds, but it has several meaningful privacy and security weaknesses that should be addressed before release. The highest-risk issues are verbose logging of network responses and user state, persistence of an admin moderation session beyond normal logout, and exposure of moderation entry points in ordinary user navigation. There are also medium-risk issues around weak local data storage choices, permissive web content loading, and onboarding state inconsistency.

This review covers only the iOS client in this repository. Backend authorization, rate limiting, audit trails, and server-side moderation enforcement still need to be verified separately.

## Findings

### 1. High: Sensitive server data is logged in production code

Files:
- `Intro/APIService.swift`
- `Intro/IntroApp.swift`
- `Intro/ContentView.swift`

Details:
- The client logs request URLs, response status codes, full response bodies, current user names, auth state, device token values, and assorted error payloads.
- In a dating app, these logs can contain profile data, moderation data, chat content, device identifiers, and other sensitive information.

Risk:
- Privacy leakage through device logs, attached diagnostics, crash reports, or captured console output during testing and support workflows.

Recommended fix:
- Remove or gate sensitive logs behind a debug-only logger that redacts values.

### 2. High: Admin moderation access is reachable from normal user navigation

Files:
- `Intro/NewSettingsScreen.swift`
- `Intro/NewProfileScreen.swift`
- `Intro/ModerationReportsScreen.swift`
- `Intro/APIService.swift`

Details:
- The app exposes navigation to the moderation reports screen from standard user-facing settings and profile flows.
- The screen itself still depends on admin login, but the route is visible to all users.
- The admin token is stored independently from the normal auth token.

Risk:
- Accidental or inappropriate access path to privileged tooling.
- Increased chance of privilege confusion on shared devices.

Recommended fix:
- Hide moderation entry points unless an admin session is already active, or move the admin tools behind a clearly separate flow.

### 3. High: Admin session is not cleared during standard logout

Files:
- `Intro/APIService.swift`

Details:
- `clearAuth()` removes the normal auth token and user state, but does not clear `adminToken`.
- A moderator/admin session can therefore outlive a regular user session on the same device.

Risk:
- Cross-user access to moderation data if the device is reused.

Recommended fix:
- Clear admin auth whenever normal auth is cleared, unless there is a deliberate product requirement not to.

### 4. Medium-High: PII is stored in UserDefaults

Files:
- `Intro/APIService.swift`

Details:
- The app stores the serialized current user record, profile completion state, avatar selection, and push token in `UserDefaults`.
- Auth tokens are kept in Keychain, which is better, but user profile data still appears to be stored in a weaker location.

Risk:
- Increased privacy exposure on device backups, diagnostics, and local inspection.

Recommended fix:
- Move sensitive persisted user data to Keychain or a protected file with an explicit data-protection class.

### 5. Medium: Arbitrary URLs can be loaded in the in-app web view

Files:
- `Intro/HyperbeamExperienceScreen.swift`

Details:
- `embedUrl` is converted directly to a `URL` and loaded in `WKWebView`.
- No allowlist or navigation restrictions are applied.

Risk:
- Rendering arbitrary or malicious content inside the app shell if upstream content is compromised.

Recommended fix:
- Allow only `https` and restrict to known trusted hosts used for the Hyperbeam experience flow.

### 6. Medium: WebSocket is marked connected before auth is confirmed

Files:
- `Intro/APIService.swift`

Details:
- The client marks the WebSocket as connected after sending the auth message, not after receiving confirmation from the server.

Risk:
- Reliability issues, message loss, and false-positive connected state.

Recommended fix:
- Wait for a server acknowledgment before exposing a connected state to the rest of the app.

### 7. Medium: Profile setup can complete after save failure

Files:
- `Intro/ProfileSetupScreen.swift`

Details:
- On failure in `savePrompts()`, the UI still marks profile setup complete and advances the user.

Risk:
- Inconsistent client/server state and bypass of required onboarding.

Recommended fix:
- Keep the user in the flow on failure and surface a retry path.

### 8. Medium: Moderation/reporting lacks meaningful client-side friction

Files:
- `Intro/ModerationActionSheet.swift`

Details:
- Reports can be submitted with empty details.
- The UI does not show any local rate controls beyond temporary button disabling.

Risk:
- Abuse or noisy moderation submissions.

Recommended fix:
- Add basic validation in the client, but rely primarily on backend rate limiting and abuse handling.

### 9. Low-Medium: Seed profiles appear in the live discover flow on API failure

Files:
- `Intro/NewDiscoverScreen.swift`

Details:
- If profile loading fails, the app falls back to hardcoded sample profiles in the main experience.

Risk:
- Misleading behavior, noisy analytics, and possible moderation/report flows against fake users.

Recommended fix:
- Replace with an explicit empty/error state instead of synthetic live data.

## Verified at Review Time

- The project built successfully.
- `ModerationReportsScreen.swift` had been repaired and no longer showed file-level diagnostics.

## Backend Validation Still Required

The following items cannot be verified from this repository:

- Server-side role checks for admin and moderation endpoints
- WebSocket auth acknowledgment protocol
- Server-side rate limiting and anti-abuse controls
- Server-side deletion semantics and retention policies
- TLS pinning or certificate hardening strategy
- Moderation audit logging and review workflow guarantees

## Recommended Immediate Remediation Order

1. Remove or redact sensitive logs.
2. Clear admin auth on normal logout.
3. Hide moderation entry points from normal users.
4. Restrict allowed web view destinations.
5. Fix profile setup so failed saves do not mark completion.
6. Review local persistence for sensitive user data.
