---
name: EAS iOS cloud build & submit (no-Mac owner)
description: How to build and submit the Intro iOS app entirely server-side via EAS, plus the operational quirks that cost the most time.
---

# Context
The app owner has NO Mac/PC — only an iPhone/iPad. Every iOS build and App Store
submission MUST happen server-side (EAS cloud build + EAS submit). Xcode /
download-page / Transporter routes are all dead. Auth to EAS is via the
`EXPO_TOKEN` secret (Expo account `superproducer64`, project `@superproducer64/intro`).

# Credentials approach (the hard part)
- EAS will NOT create/validate an iOS Distribution cert non-interactively, even with
  ASC API key env vars. Workaround: generate the cert + provisioning profile yourself
  via the App Store Connect REST API, write `mobile/credentials.json` +
  `mobile/credentials/dist.p12` + `mobile/credentials/profile.mobileprovision`, and set
  `build.production.ios.credentialsSource = "local"` in `mobile/eas.json`.
  Then the build logs `✔ Using local iOS credentials (credentials.json)`.
- The App Store Connect API key (.p8) lives in `attached_assets/` and is referenced by
  `submit.production.ios.ascApiKeyPath/Id/IssuerId` in eas.json. The key ID / issuer ID
  are stored there, not in memory. If the key is ever deleted in ASC it returns 401 —
  the owner must create a NEW key and re-save the .p8.
- ASC JWT signing: ES256 via `crypto.sign('sha256', data, {key, dsaEncoding:'ieee-p1363'})`,
  header `{alg:ES256,kid,typ:JWT}`, payload aud `appstoreconnect-v1`.

# Operational quirks that wasted the most time
- **`/tmp` is wiped between agent turns.** Always recreate `/tmp/AuthKey_*.p8` from
  `attached_assets/` in the SAME bash call that uses it.
- **Detached/`nohup` processes do NOT survive a turn boundary** — they get killed and
  their logs (in /tmp) vanish. Do not rely on backgrounding to outlast a turn.
- **`eas build` upload can exceed the 120s bash-tool limit.** Run it in ONE synchronous
  call with `--no-wait` and `EAS_SKIP_AUTO_FINGERPRINT=1` (logs `Skipping project fingerprint`).
  A clean run reaches `Uploaded to EAS` + prints the build link in ~25-30s and the job then
  continues server-side. Detect success by polling Expo GraphQL for a new `appBuildVersion`
  rather than trusting the killed CLI.
- **EAS archive root = the git repo root, NOT the project dir.** Even with `EAS_NO_VCS=1`,
  eas-cli finds the only `.git` (at the workspace root) and archives the WHOLE monorepo
  (`mobile/` + `Intro/` + `original-intro/` + web app + every `.cache`/`node_modules`).
  It uses `.gitignore` UNLESS a `.easignore` exists **at that archive root** — a
  `mobile/.easignore` is silently ignored. Fix: keep a `/.easignore` (workspace root) that
  excludes `node_modules`, the sibling project dirs, and **`.cache/`** (a ~1GB
  `.cache/dotslash` holds a read-only React Native DevTools binary; if archived, the
  tarball upload fails on cleanup with `EACCES: permission denied, rmdir ... -shallow-clone
  /.cache/dotslash/...React Native DevTools-linux-x64`). With the root `.easignore` the
  tarball drops to ~300 KB and uploads instantly.
- **`eas submit` runs SERVER-SIDE.** Even if the CLI call is killed at 120s, the
  submission job keeps running on EAS. Poll it via GraphQL instead of re-running.
- Poll status via Expo GraphQL `https://api.expo.dev/graphql` (Bearer EXPO_TOKEN):
  builds = `builds{byId(buildId:"..."){status error{errorCode message}}}`,
  submissions = `submissions{byId(submissionId:"..."){status error{...}}}`,
  or a build's `submissions{...}`. There is NO `eas submission:list` command in CLI v18.
- The globally-installed `eas` binary is at `.config/npm/node_global/bin/eas`.
  Prefer it over `npx eas-cli@latest` — concurrent npx runs corrupt the npx cache (ENOTEMPTY).
- **Use eas-cli >= 20.x.** v18.4.0 hard-crashes a production build during the "discourage
  Expo Go" check: `Cannot find module 'expo-dev-client/package.json'` (it calls the throwing
  `resolveFrom` instead of the silent one). This project legitimately has NO expo-dev-client,
  so the crash is spurious. v20.2.0 catches the missing module and continues. Do NOT "fix" it
  by installing expo-dev-client into a prod App Store build — upgrade the CLI instead.
  (`EXPO_DEBUG=1` is what surfaced this; non-debug runs swallowed it and looked like a stall.)

# Version / build-number rule (critical, easy to get wrong)
- Because `mobile/ios/` exists (from `expo prebuild`), EAS IGNORES app.json's
  `version`/`bundleIdentifier` and uses the NATIVE values. The effective marketing
  version comes from `ios/Intro/Info.plist` `CFBundleShortVersionString` (literal value,
  not the pbxproj MARKETING_VERSION variable). Build number = Info.plist `CFBundleVersion`.
- **The build's CFBundleShortVersionString must EXACTLY match the App Store version
  string** or it won't be attachable to that App Store version. ASC stored "1.0", so a
  build emitting "1.0.0" is unusable — set Info.plist to "1.0". Build number must be
  strictly greater than the existing build for that version.
- Always check actual ASC state before choosing a version — query
  `/v1/apps/{id}/appStoreVersions` and `/v1/builds?filter[app]={id}`. (The rejected
  version here turned out to be 1.0, not the 1.2.0 that earlier notes assumed.)

# Bundling gotcha
- `mobile/babel.config.js` had a `nativewind/babel` plugin that was never installed/used
  → Metro "Cannot find module 'nativewind/babel'" failed the EAS "Bundle JavaScript"
  phase (~2min in). Removed it; babel-preset-expo alone is enough (it auto-wires the
  reanimated/worklets plugin in SDK 55). Reproduce bundling locally with
  `cd mobile && npx expo export --platform ios` BEFORE spending a cloud build.

# Final manual step (owner does this in App Store Connect UI)
- Build is uploaded + attached to the version via API, but "Submit for Review" is left
  to the owner because the 2.3.3 metadata fix is still pending. Attaching a build to a
  REJECTED version works: `PATCH /v1/appStoreVersions/{verId}/relationships/build`
  with `{data:{type:"builds",id:buildId}}` → 204.
