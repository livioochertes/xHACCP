---
name: Admin i18n Architecture
description: How the admin panel i18n system is built — react-i18next, source files, build process
---

## Admin Panel i18n Architecture

The admin panel uses a proper react-i18next setup (NOT DOM-based hacks).

### Source Files
- `admin-src/AdminApp.jsx` — 10k-line JSX source (recovered from git history at 5b40995~1, modified with react-i18next hooks)
- `admin-src/i18n.js` — i18next initialization with market-based language detection
- `admin-src/LanguageSwitcher.jsx` — React component (inline buttons, no dropdown)
- `admin-src/locales/en.json`, `ro.json`, `fr.json` — translation files (~100 keys each)
- `admin-src/build.js` — esbuild build script (ESM format)

### Build Command
```bash
node admin-src/build.js
```
Outputs to `admin/vendor/admin-bundle.js` (format: IIFE, ~939KB unminified).

### Language Detection Order
1. `localStorage.getItem('adminLang')` — explicit user choice
2. `adminUser.adminMarkets[0]` mapping: `ro→ro`, `fr→fr`, `com→en`
3. Fallback: `ro`

### Adding More Translations
1. Edit `admin-src/AdminApp.jsx` — add `t('some.key')` calls
2. Add keys to all 3 locale files
3. Run `node admin-src/build.js`

### admin/index.html
Minimal: only CSS styles, loading overlay, Excel CDN preload, `admin-bundle.js` script.
NO separate react/react-dom vendor scripts (all bundled into admin-bundle.js).

### Admin bundle cache version
After rebuilding the Admin bundle, change the version query on its script URL.

**Why:** Browsers or intermediary caches can continue serving an older Admin bundle even when the generated file on disk is current, making verified source changes appear ineffective.

**How to apply:** Whenever Admin behavior changes and the bundle is rebuilt, assign a new version query before verifying the served page.

**Why:** Original JSX source was in git history but was compiled into admin-bundle.js
in commit 5b40995 and source was never saved separately. DOM-based translation approach
was fragile (setInterval + walkDOM failed on React re-renders). Proper solution is
react-i18next integrated at the React component level.
