---
name: Apple Guideline 1.2 UGC compliance (Intro dating app)
description: What Apple App Review requires for user-generated-content safety, and how this app satisfies it
---

# Apple Guideline 1.2 (UGC safety) — requirements & how Intro satisfies them

Apple rejected v1.0 for incomplete UGC safety. To pass, an app with UGC needs ALL of:
1. A **EULA / terms** the user must agree to **before accessing UGC**. Must work for the
   reviewer, who logs in with the **demo account** (login, NOT register) — so a register-only
   checkbox is NOT enough. Implemented as `GuidelinesGate` wrapping `MainTabs` in
   `AppNavigator.js`, persisted in SecureStore. A register checkbox alone fails this.
2. A **report/flag** mechanism on every surface where UGC appears (Discover AND Chat).
3. A **block** mechanism that **removes the user from the feed instantly**.
4. Block must **also notify the developer** — so `/api/safety/block` inserts a `reports`
   row (reason 'Blocked user') in addition to the `blocks` row. Do not rely on the separate
   report endpoint alone.
5. A **pre-populated demo account** with real content so the reviewer can test block/report.
6. A **screen recording** (owner-supplied in App Store Connect reply) showing terms gate →
   report → block.

**Why:** Apple's literal rejection text says "blocking should also notify the developer" and
"EULA before accessing UGC" — both are easy to miss if you only add UI buttons.

## App-specific wiring
- Backend feed filtering already lives in `match.js /profiles`: excludes blocked users in
  BOTH directions (blocker→blocked and blocked→blocker). So inserting a `blocks` row is
  sufficient for server-side instant removal; the client also filters locally for immediacy.
- Report/block client calls (`reportUser`, `blockUser`) live in `mobile/src/services/api.js`
  and were ORIGINALLY MISSING while `ReportBlockModal.js` already called them — i.e. the UI
  existed but crashed. When auditing safety features, verify the API functions exist, not just
  the buttons.

## Separate rejection: Guideline 2.3.3 (screenshots)
Not a code issue. The 6.5-inch iPhone screenshots only showed the login screen. Owner must
upload real in-use screenshots (swiping/matches/chat) per device size in App Store Connect.
Easiest capture path: install TestFlight build on iPhone and screenshot the running app.
