import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import WebSocket from "ws";

const source = (path) => readFile(path, "utf8");
const baseUrl = process.env.STOREFRONT_BASE_URL || "http://127.0.0.1:5000";

function luminance(hsl) {
  const [h, s, l] = hsl.map((value, index) => index ? value / 100 : value / 360);
  const hue = (p, q, t) => {
    t = (t + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const rgb = [h + 1 / 3, h, h - 1 / 3].map((t) => hue(p, q, t));
  return rgb.map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
}

test("destructive badge contrast, zoom, table semantics and localized labels", async () => {
  const css = await source("client/src/index.css");
  for (const block of [css.split(".dark")[0], css.split(".dark")[1].split("@layer")[0]]) {
    const token = (name) => block.match(new RegExp(`--${name}: hsl\\(([^)]+)\\)`))[1]
      .split(",").map((part) => parseFloat(part));
    const values = [luminance(token("destructive")), luminance(token("destructive-foreground"))].sort((a, b) => b - a);
    const contrast = (values[0] + 0.05) / (values[1] + 0.05);
    assert.ok(contrast >= 4.5, `Badge contrast is ${contrast.toFixed(2)}:1`);
  }
  const badge = await source("client/src/components/ui/badge.tsx");
  assert.match(badge, /text-destructive-foreground hover:bg-destructive"/);
  assert.doesNotMatch(badge, /hover:bg-destructive\//);
  const html = await source("client/index.html");
  assert.doesNotMatch(html, /maximum-scale|user-scalable/);
  const details = await source("client/src/pages/product-details.tsx");
  assert.match(details, /<th scope="row"[^>]*>\{spec\.label\}<\/th>/);
  assert.match(details, /<td[^>]*>\{spec\.value\}<\/td>/);
  const translations = await source("client/src/translations/index.ts");
  for (const locale of ["en", "es", "fr", "de", "ro", "it", "pt", "zh", "ja", "ko", "ar"]) {
    const block = translations.split(`  ${locale}: {`)[1].split(/\n  [a-z]{2}: \{/)[0];
    for (const key of ["nav.mainNavigation", "nav.openMenu", "search.label", "products.gridView",
      "products.listView", "home.previousProducts", "home.nextProducts", "home.newsletter.emailLabel", "ai.messageLabel"]) {
      assert.ok(block.includes(`'${key}':`), `${locale} is missing ${key}`);
    }
  }
});

test("public pages expose labels; inactive hero controls cannot focus; mobile dialog is named", { timeout: 60000 }, async () => {
  const profile = await mkdtemp(join(tmpdir(), "storefront-a11y-"));
  const chromium = process.env.CHROMIUM_PATH ||
    (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : "chromium");
  const browser = spawn(chromium, ["--headless", "--no-sandbox", "--disable-dev-shm-usage",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"]);
  let output = "";
  browser.stderr.on("data", (data) => { output += data; });
  let socket;
  try {
    const wait = async (fn) => {
      for (let i = 0; i < 150; i++) {
        const value = await fn();
        if (value) return value;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error("Timed out waiting for storefront browser state");
    };
    const endpoint = await wait(() => output.match(/DevTools listening on (ws:\/\/\S+)/)?.[1]);
    const targets = await (await fetch(endpoint.replace(/^ws:/, "http:").replace(/\/devtools\/browser\/[^/]+$/, "/json/list"))).json();
    socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    let id = 0;
    const pending = new Map();
    socket.on("message", (raw) => {
      const message = JSON.parse(raw.toString());
      if (!pending.has(message.id)) return;
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const requestId = ++id;
      pending.set(requestId, { resolve, reject });
      socket.send(JSON.stringify({ id: requestId, method, params }));
    });
    const evaluate = async (expression) => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    await send("Page.enable");
    // Deterministic, read-only browser fixture: exercise multiple promotional slides.
    await send("Page.addScriptToEvaluateOnNewDocument", { source: `
      const realFetch = window.fetch;
      window.fetch = function(url, options) {
        if (String(url) === '/api/homepage-hero') return Promise.resolve(new Response(JSON.stringify({
          slides: [{id: 8001, slideType: 'text', title: 'Accessibility test promotion',
            ctaLabel: 'Browse products', ctaType: 'link', ctaUrl: '/products'}],
          autoplaySeconds: 120
        }), {headers: {'Content-Type': 'application/json'}}));
        return realFetch.call(this, url, options);
      };
    ` });
    await send("Page.navigate", { url: `${baseUrl}/` });
    await wait(() => evaluate(`document.querySelectorAll('[aria-roledescription="slide"]').length > 1`));
    assert.match(await evaluate(`document.querySelector('[aria-roledescription="slide"][aria-hidden="false"]')?.textContent || ''`),
      /Accessibility test promotion/);
    assert.equal(await evaluate(`(() => {
      const slides = [...document.querySelectorAll('[aria-roledescription="slide"]')];
      return slides.filter(s => !s.inert && s.getAttribute('aria-hidden') === 'false').length;
    })()`), 1);
    assert.equal(await evaluate(`(() => {
      const inactive = document.querySelector('[aria-roledescription="slide"][aria-hidden="true"]');
      return inactive.inert && [...inactive.querySelectorAll('a,button')].every(control => {
        control.focus(); return document.activeElement !== control;
      });
    })()`), true);
    await evaluate(`document.querySelector('[aria-label="Next promotion"]').click()`);
    await wait(() => evaluate(`document.querySelectorAll('[aria-roledescription="slide"]')[1].getAttribute('aria-hidden') === 'false'`));
    assert.equal(await evaluate(`(() => {
      const control = document.querySelector('[aria-roledescription="slide"][aria-hidden="false"] a');
      control.focus(); return document.activeElement === control;
    })()`), true);
    assert.ok(await evaluate(`document.querySelector('header input').getAttribute('aria-label')`));
    assert.ok(await evaluate(`document.querySelector('input[type="email"]').getAttribute('aria-label')`));
    for (const selector of ['[data-testid="carousel-prev-button"]', '[data-testid="carousel-next-button"]']) {
      assert.ok(await evaluate(`!document.querySelector('${selector}') || document.querySelector('${selector}').getAttribute('aria-label')`));
    }
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.ok(await evaluate(`document.querySelector('header a[href="/cart"]').getAttribute('aria-label')`));
    await evaluate(`document.querySelector('header button[aria-haspopup="dialog"][class*="md:hidden"]').click()`);
    await wait(() => evaluate(`!!document.querySelector('[role="dialog"]')`));
    assert.ok(await evaluate(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return document.getElementById(dialog.getAttribute('aria-labelledby'))?.textContent.trim();
    })()`));
    assert.ok(await evaluate(`document.querySelector('[role="dialog"] input').getAttribute('aria-label')`));
    await send("Page.navigate", { url: `${baseUrl}/products` });
    await wait(() => evaluate(`!!document.querySelector('input[name="search"]')`));
    assert.ok(await evaluate(`document.querySelector('input[name="search"]').getAttribute('aria-label')`));
    assert.equal(await evaluate(`[...document.querySelectorAll('button[aria-pressed]')].every(b => !!b.getAttribute('aria-label'))`), true);
    assert.equal(await evaluate(`document.querySelectorAll('button[aria-pressed]').length`), 2);
    await evaluate(`document.querySelector('button[aria-pressed="false"]').click()`);
    assert.equal(await evaluate(`document.querySelectorAll('button[aria-pressed="true"]').length`), 1);
    await send("Page.navigate", { url: `${baseUrl}/ai-assistant` });
    await wait(() => evaluate(`!!document.querySelector('form button[type="submit"]')`));
    assert.ok(await evaluate(`document.querySelector('form button[type="submit"]').closest('form').querySelector('input').getAttribute('aria-label')`));
    assert.ok(await evaluate(`document.querySelector('form button[type="submit"]').getAttribute('aria-label')`));
  } finally {
    socket?.close();
    browser.kill();
    await new Promise((resolve) => browser.exitCode !== null ? resolve() : browser.once("exit", resolve));
    await rm(profile, { recursive: true, force: true });
  }
});