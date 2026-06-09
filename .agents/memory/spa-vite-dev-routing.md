---
name: SPA routes Vite dev routing
description: Root cause and fix for blank preview / @vitejs/plugin-react preamble error in dev mode
---

## The Rule
In development, ALL HTML responses must pass through Vite's `transformIndexHtml`. Any Express route that serves raw `client/index.html` directly (without Vite transformation) will produce a blank page with `@vitejs/plugin-react can't detect preamble. Something is wrong.` error in the console.

**Why:** Vite's React plugin injects `window.$RefreshReg$` / `window.$RefreshSig$` setup code into the HTML via `transformIndexHtml`. If the HTML is served raw (bypassing Vite), modules transformed by Vite still expect those globals and throw on load.

**How to apply:**
1. `server/seo-routes.ts` — every route handler has `const isDev = process.env.NODE_ENV !== 'production'` guard at the top, and `if (isDev) return next()` as the first line of each handler.
2. `server/routes.ts` — the `app.get('*', ...)` catch-all 404 handler must include all known SPA routes in `KNOWN_SPA_EXACT` / `KNOWN_SPA_PREFIXES` so they call `next()` and reach Vite's catch-all (`app.use("*", ...)` that calls `vite.transformIndexHtml`). Missing a route here causes it to return `build404Html()` — a raw HTML page without the preamble — making the app blank.
