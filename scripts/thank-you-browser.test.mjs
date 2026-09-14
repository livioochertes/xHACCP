import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import WebSocket from "ws";

const baseUrl = process.env.THANK_YOU_BASE_URL || `http://127.0.0.1:${process.env.PORT || 5000}`;
const chromiumPath = process.env.CHROMIUM_PATH ||
  (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : "chromium");

const seededCart = [{
  id: 181001,
  userId: 0,
  productId: 181,
  market: "ro",
  quantity: 2,
  createdAt: "2026-09-14T00:00:00.000Z",
  updatedAt: "2026-09-14T00:00:00.000Z",
  product: {
    id: 181,
    name: "Browser test product",
    price: "25.00",
  },
}];

class DevToolsClient {
  #socket;
  #nextId = 1;
  #pending = new Map();

  constructor(socket) {
    this.#socket = socket;
    socket.on("message", (rawMessage) => {
      const message = JSON.parse(rawMessage.toString());
      if (!message.id) return;

      const pending = this.#pending.get(message.id);
      if (!pending) return;
      this.#pending.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error.message));
      } else {
        pending.resolve(message.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.#socket.close();
  }
}

async function waitForDevToolsTarget(output) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10_000) {
    const combinedOutput = output.join("");
    const match = combinedOutput.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) {
      const response = await fetch(match[1].replace(/^ws:/, "http:").replace(/\/devtools\/browser\/[^/]+$/, "/json/list"));
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Chromium did not expose a DevTools target.\n${output.join("")}`);
}

async function waitForHttpServer() {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < 10_000) {
    try {
      const response = await fetch(`${baseUrl}/merci`);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`The app is not reachable at ${baseUrl}: ${lastError?.message}`);
}

async function waitForPageState(client) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10_000) {
    const result = await client.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const cartLink = document.querySelector('header a[href="/cart"]');
        return {
          title: document.querySelector("h1")?.textContent?.trim() || "",
          cartLinkText: cartLink?.textContent?.trim() || "",
          cartStorage: localStorage.getItem("guestCart:ro"),
          analytics: window.__thankYouAnalytics || [],
        };
      })()`,
    });
    const state = result?.result?.value;

    if (state?.title) return state;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("The thank-you page did not render a heading.");
}

async function stopBrowser(browser, profileDirectory) {
  if (browser.exitCode === null) {
    browser.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => browser.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 2_000)),
    ]);
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rm(profileDirectory, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

test("direct /merci access keeps an existing cart and does not track a purchase", async (t) => {
  await waitForHttpServer();

  const profileDirectory = await mkdtemp(join(tmpdir(), "xhaccp-thank-you-"));
  const browser = spawn(chromiumPath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  const browserOutput = [];
  browser.stdout.on("data", (chunk) => browserOutput.push(chunk.toString()));
  browser.stderr.on("data", (chunk) => browserOutput.push(chunk.toString()));

  t.after(async () => {
    await stopBrowser(browser, profileDirectory);
  });

  const targetUrl = await waitForDevToolsTarget(browserOutput);
  const socket = new WebSocket(targetUrl);
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  const client = new DevToolsClient(socket);
  t.after(() => client.close());

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      localStorage.setItem("xhaccp-language", "en");
      localStorage.setItem("guestCart:ro", ${JSON.stringify(JSON.stringify(seededCart))});
      window.__thankYouAnalytics = [];
      window.umami = {
        track(name, data) {
          window.__thankYouAnalytics.push({ name, data });
        },
      };
    })();`,
  });
  await client.send("Page.navigate", { url: `${baseUrl}/merci` });

  const state = await waitForPageState(client);
  assert.equal(state.title, "Payment status not confirmed");
  assert.match(state.cartLinkText, /Cart/);
  assert.match(state.cartLinkText, /2/);
  assert.deepEqual(JSON.parse(state.cartStorage), seededCart);
  assert.equal(
    state.analytics.some((event) => event.name === "purchase_completed"),
    false,
  );
});