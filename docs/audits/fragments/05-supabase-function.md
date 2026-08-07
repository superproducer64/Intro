## 5. Supabase Edge Function Integration

Scope: `supabase/functions/create-video-call/index.ts` and its call site(s) in the Node backend (`server.js`, root `*.js`), the mobile app (`mobile/src`), and the legacy static web frontend (`public/`).

### What the function does (`supabase/functions/create-video-call/index.ts`)

A Deno edge function invoked over HTTP POST. It: validates the request has an `Authorization` header, builds a Supabase client scoped to the caller's JWT, resolves the calling user via `supabase.auth.getUser()`, requires a `match_id` in the JSON body, looks up that match and confirms the caller is `user1_id` or `user2_id` on it, then — using a `DAILY_API_KEY` read from the edge function's own environment (never exposed to the client) — calls the Daily.co REST API twice: `POST https://api.daily.co/v1/rooms` to create a private room, then `POST https://api.daily.co/v1/meeting-tokens` to mint a room-scoped meeting token (required because the room is private). It appends the token to the room URL, inserts a row into the `video_calls` table (`match_id`, `initiated_by`, `room_name`, `room_url`, `status: "pending"`), and returns that row as `{ call: callRow }`.

### Step 2 — who calls it

```
grep -rln "create-video-call" server.js *.js mobile/src public
```
returned exactly one file: `mobile/src/services/api.js`.

The single call site is `createVideoCall(matchId)` at `mobile/src/services/api.js:499-511`:

```js
export async function createVideoCall(matchId) {
  const { data, error } = await supabase.functions.invoke('create-video-call', {
    body: { match_id: matchId },
  });
  ...
  return data.call;
}
```

This uses the Supabase JS client's `functions.invoke()`, which calls the edge function directly over HTTPS using the mobile app's Supabase session — it does not route through the Node/Express backend (`server.js`) at all. No other caller exists: the root Node backend files (`server.js`, `admin.js`, `auth.js`, `cafe.js`, `check-stranded.js`, `cron.js`, `db.js`, `match.js`, `message.js`, `middleware.js`, `migrate.js`, `profile.js`, `reports.js`, `safety.js`, `websocket.js`) were grepped for `daily|Daily|video_call|video-call` and none matched, and `public/` (the legacy static web frontend) has no reference to `create-video-call`, `daily`, `Daily`, or `video_call` either.

### Step 3 — Daily.co logic elsewhere (duplication check)

```
grep -rln "daily\|Daily" server.js *.js mobile/src | grep -v node_modules
```
returned two files: `mobile/src/services/api.js` and `mobile/src/screens/VideoCall/VideoCallScreen.js`. No root-level Node backend file matched.

- `mobile/src/services/api.js` — besides `createVideoCall` (which only invokes the edge function), the "VIDEO CALLS (Daily)" section (lines 496-549) contains `declineVideoCall`/`endVideoCall` (plain `video_calls` table updates via the Supabase client) and `subscribeToVideoCalls`/`unsubscribeFromVideoCalls` (Supabase Realtime subscriptions on the `video_calls` table). None of these talk to the Daily.co API directly — they only touch the app's own `video_calls` table.
- `mobile/src/screens/VideoCall/VideoCallScreen.js` — imports `@daily-co/react-native-daily-js` (`import Daily, { DailyMediaView } from '@daily-co/react-native-daily-js';`, line 3) and uses `Daily.createCallObject()` / `.join()` to actually join the call using the `room_url` (with token) that `createVideoCall()` returned. This is the Daily *client SDK* consuming a pre-built joinable URL — it does not create rooms or call Daily's room/token REST endpoints; room creation and the `DAILY_API_KEY` secret live only in the edge function.

Corroborating evidence: the root `package.json` has no `daily`-related dependency, while `mobile/package.json` lists `@daily-co/config-plugin-rn-daily-js`, `@daily-co/react-native-daily-js`, and `@daily-co/react-native-webrtc` — confirming the Daily *client* SDK is mobile-only and the Node backend has no Daily dependency or logic whatsoever.

### Findings

No finding — cleanly integrated. Step 2 shows a single, clear call site (`createVideoCall()` in `mobile/src/services/api.js`, invoking the edge function directly via `supabase.functions.invoke('create-video-call', ...)`), and Step 3 shows no duplicated Daily.co room-creation logic: the edge function is the only place that holds `DAILY_API_KEY` and calls Daily's `/v1/rooms` and `/v1/meeting-tokens` REST endpoints, while the two other Daily-related hits are (a) plain `video_calls` table reads/writes/subscriptions with no Daily API calls, and (b) the Daily *client* SDK in `VideoCallScreen.js` joining the room the edge function already built — a legitimate, non-duplicative division of labor (server-side secret-holding room creation in the edge function; client-side call-join UI in the mobile app). The Node/Express backend is not involved in the video-call flow at all — not as an orphaned parallel path, just genuinely uninvolved, since the mobile app talks to the edge function directly.
