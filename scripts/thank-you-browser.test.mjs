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

async function waitForPageState(client, isReady = (state) => Boolean(state?.title)) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10_000) {
    const result = await client.send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const cartLink = document.querySelector('header a[href="/cart"]');
        return {
          title: document.querySelector("h1")?.textContent?.trim() || "",
          cartLinkText: cartLink?.textContent?.trim() || "",
          cartBadgeText: cartLink?.querySelector(".absolute")?.textContent?.trim() || null,
          cartStorage: localStorage.getItem("guestCart:ro"),
          legacyCartStorage: localStorage.getItem("guestCart"),
          summaryText: document.querySelector("h2")?.textContent?.trim() || "",
          actionHref: document.querySelector("main a")?.getAttribute("href") || null,
          actionText: document.querySelector("main a")?.textContent?.trim() || "",
          analytics: window.__thankYouAnalytics || [],
        };
      })()`,
    });
    const state = result?.result?.value;

    if (isReady(state)) return state;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error("The thank-you page did not reach the expected state.");
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

async function openThankYouPage(t, paymentResult) {
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
  const orderSummary = {
    orderId: 184,
    buyerName: "Browser Test",
    subtotal: 50,
    discountAmount: 0,
    voucherCode: null,
    shipping: 0,
    total: 50,
    currencySymbol: "lei",
  };
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      localStorage.setItem("xhaccp-language", "en");
      if (!sessionStorage.getItem("__thankYouBrowserSeeded")) {
        localStorage.setItem("guestCart:ro", ${JSON.stringify(JSON.stringify(seededCart))});
        localStorage.setItem("guestCart", ${JSON.stringify(JSON.stringify(seededCart))});
        sessionStorage.setItem("__thankYouBrowserSeeded", "1");
      }
      localStorage.setItem("xhaccp_pending_order_summary", ${JSON.stringify(JSON.stringify(orderSummary))});
      window.__thankYouAnalytics = JSON.parse(sessionStorage.getItem("__thankYouAnalytics") || "[]");
      window.umami = {
        track(name, data) {
          window.__thankYouAnalytics.push({ name, data });
          sessionStorage.setItem("__thankYouAnalytics", JSON.stringify(window.__thankYouAnalytics));
        },
      };
    })();`,
  });
  const query = paymentResult ? `?payment=${paymentResult}` : "";
  await client.send("Page.navigate", { url: `${baseUrl}/merci${query}` });

  return client;
}

test("direct /merci access keeps an existing cart and does not track a purchase", async (t) => {
  await waitForHttpServer();

  const client = await openThankYouPage(t, null);

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

test("failed payment keeps the cart available and offers checkout retry", async (t) => {
  await waitForHttpServer();

  const client = await openThankYouPage(t, "failed");
  const state = await waitForPageState(client);

  assert.equal(state.title, "Payment didn't go through");
  assert.equal(state.actionHref, "/checkout");
  assert.match(state.actionText, /Return to checkout/i);
  assert.match(state.cartLinkText, /Cart/);
  assert.match(state.cartLinkText, /2/);
  assert.deepEqual(JSON.parse(state.cartStorage), seededCart);
  assert.deepEqual(JSON.parse(state.legacyCartStorage), seededCart);
  assert.equal(state.cartBadgeText, "2");
  assert.equal(
    state.analytics.some((event) => event.name === "purchase_completed"),
    false,
  );
  assert.equal(
    state.analytics.filter((event) => event.name === "payment_failed").length,
    1,
  );
});

test("successful payment clears the cart and tracks one purchase across reloads", async (t) => {
  await waitForHttpServer();

  const client = await openThankYouPage(t, "success");
  const state = await waitForPageState(
    client,
    (current) =>
      current?.title &&
      current.summaryText &&
      current.cartStorage === null &&
      current.legacyCartStorage === null &&
      current.cartBadgeText === null &&
      current.analytics.filter((event) => event.name === "purchase_completed").length === 1,
  );

  assert.equal(state.title, "Order placed successfully!");
  assert.match(state.summaryText, /Order summary/i);
  assert.equal(state.cartStorage, null);
  assert.equal(state.legacyCartStorage, null);
  assert.equal(state.cartBadgeText, null);
  assert.deepEqual(
    state.analytics.filter((event) => event.name === "purchase_completed"),
    [{
      name: "purchase_completed",
      data: {
        payment_method: "viva",
        market: "ro",
        value: 50,
        currency: "lei",
      },
    }],
  );

  await client.send("Page.reload", { ignoreCache: true });
  const reloadedState = await waitForPageState(
    client,
    (current) =>
      current?.title &&
      current.cartStorage === null &&
      current.legacyCartStorage === null &&
      current.cartBadgeText === null &&
      current.analytics.filter((event) => event.name === "purchase_completed").length === 1,
  );
  assert.equal(
    reloadedState.analytics.filter((event) => event.name === "purchase_completed").length,
    1,
  );
});

test("cash payment clears the cart and tracks cash as the payment method", async (t) => {
  await waitForHttpServer();

  const client = await openThankYouPage(t, "cash");
  const state = await waitForPageState(
    client,
    (current) =>
      current?.title &&
      current.cartStorage === null &&
      current.legacyCartStorage === null &&
      current.cartBadgeText === null &&
      current.analytics.filter((event) => event.name === "purchase_completed").length === 1,
  );

  assert.equal(state.cartStorage, null);
  assert.equal(state.legacyCartStorage, null);
  assert.equal(state.cartBadgeText, null);
  assert.deepEqual(
    state.analytics.filter((event) => event.name === "purchase_completed"),
    [{
      name: "purchase_completed",
      data: {
        payment_method: "cash",
        market: "ro",
        value: 50,
        currency: "lei",
      },
    }],
  );
});
