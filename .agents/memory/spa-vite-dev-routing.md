---
name: SPA routes Vite dev routing
description: Root cause and fix for blank preview / @vitejs/plugin-react preamble error in dev mode
---

## The Rule
In development, ALL HTML responses must pass through Vite's `transformIndexHtml`. Any Express route that serves raw `client/index.html` directly (without Vite transformation) will produce a blank page with `@vitejs/plugin-react can't detect preamble. Something is wrong.` error in the console.

**Why:** Vite's React plugin injects `window.$RefreshReg$` / `window.$RefreshSig$` setup code into the HTML via `transformIndexHtml`. If the HTML is served raw (bypassing Vite), modules transformed by Vite still expect those globals and throw on load.

**How to apply:** Public HTML rendering and error pages may respond in development, but must use the running Vite instance to transform the complete HTML before sending it. Do not restore development-only bypasses: they hide initial-HTML regressions from preview checks.
