---
name: Web static page — CSP and publish-flow truncation
description: Why public/index.html can white-screen — helmet CSP blocks inline JS, and the publish flow has truncated the file before.
---

# Express static web page pitfalls (public/)

The Express server uses `app.use(helmet())` with its **default CSP**, which sets
`script-src 'self'` and `script-src-attr 'none'`. This blocks BOTH inline
`<script>` blocks AND inline `onclick="..."` handlers.

**Rule:** all JavaScript for static pages in `public/` must live in external
`.js` files served from the same origin (e.g. `<script src="/app-auth.js">`),
and events must be wired with `addEventListener` — never inline `onclick`.
Inline `<style>` is fine (helmet default `style-src` allows `'unsafe-inline'`).

**Why:** an inline script renders the page HTML but silently fails to execute
(console: "Refused to execute inline script ... violates CSP script-src 'self'"),
so forms/buttons look fine but do nothing.

## Publish flow can clobber public/index.html
A "Published your App" commit once truncated `public/index.html` down to just its
`<script>` block — losing `<!DOCTYPE>`, `<head>`, `<body>` and all visible
markup — producing a pure white screen. The previous good version was recoverable
from the prior commit via `git show <commit>:public/index.html`.

**How to apply:** if the web app suddenly white-screens, first check whether
`public/index.html` still begins with `<!DOCTYPE html>` and contains its body
markup; if it was truncated, restore from the last good commit. Keep JS external
so a restore stays CSP-compliant.
