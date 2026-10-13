import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import WebSocket from "ws";

const baseUrl = process.env.VIVA_CHECKOUT_BACK_BASE_URL || `http://127.0.0.1:${process.env.PORT || 5000}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const seededCart = [{
  id: 352001,
  userId: 0,
  productId: 181,
  market: "ro",
  quantity: 1,
  createdAt: "2026-10-13T00:00:00.000Z",
  updatedAt: "2026-10-13T00:00:00.000Z",
  product: {
    id: 181,
    name: "Browser test product",
    price: "25.00",
    currency: "RON",
    status: "active",
  },
}];

class DevToolsClient {
  #socket;
  #nextId = 1;
  #pending = new Map();
  onEvent;

  constructor(socket) {
    this.#socket = socket;
    socket.on("message", (rawMessage) => {
      const message = JSON.parse(rawMessage.toString());
      if (message.id) {
        const pending = this.#pending.get(message.id);
        if (!pending) return;
        this.#pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      this.onEvent?.(message);
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

async function waitForDevToolsTarget(browserOutput) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    const endpoint = browserOutput.join("").match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
    if (endpoint) {
      const response = await fetch(endpoint.replace(/^ws:/, "http:").replace(/\/devtools\/browser\/[^/]+$/, "/json/list"));
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    }
    await sleep(50);
  }
  throw new Error(`Chromium did not expose a DevTools target.\n${browserOutput.join("")}`);
}

async function waitForHttpServer() {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < 10_000) {
    try {
      const response = await fetch(`${baseUrl}/checkout`);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`The app is not reachable at ${baseUrl}: ${lastError?.message}`);
}

test("Viva checkout recovers after browser Back and a failed order request", { timeout: 90_000 }, async (t) => {
  await waitForHttpServer();

  const profile = await mkdtemp(join(tmpdir(), "viva-checkout-back-browser-"));
  const browser = spawn(process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium", [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });
  const browserOutput = [];
  browser.stdout.on("data", (chunk) => browserOutput.push(chunk.toString()));
  browser.stderr.on("data", (chunk) => browserOutput.push(chunk.toString()));

  let client;
  const paymentRequests = [];
  const interceptionErrors = [];
  t.after(async () => {
    client?.close();
    if (browser.exitCode === null) {
      browser.kill("SIGTERM");
      await Promise.race([
        new Promise((resolve) => browser.once("exit", resolve)),
        sleep(2_000),
      ]);
    }
    await rm(profile, { recursive: true, force: true });
  });

  const socket = new WebSocket(await waitForDevToolsTarget(browserOutput));
  await new Promise((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  client = new DevToolsClient(socket);

  const evaluate = async (expression) => {
    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, description = expression) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 15_000) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`Browser condition did not become true: ${description}`);
  };
  const clickButton = async (text) => {
    const clicked = await evaluate(`(() => {
      const button = [...document.querySelectorAll("button")]
        .find((candidate) => candidate.textContent.trim() === ${JSON.stringify(text)});
      if (!button) return false;
      button.click();
      return true;
    })()`);
    assert.equal(clicked, true, `Found the "${text}" checkout button`);
  };

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      localStorage.setItem("xhaccp-language", "en");
      if (!sessionStorage.getItem("__vivaBackCartSeeded")) {
        const cart = ${JSON.stringify(seededCart)};
        localStorage.setItem("guestCart:ro", JSON.stringify(cart));
        localStorage.setItem("guestCart", JSON.stringify(cart));
        sessionStorage.setItem("__vivaBackCartSeeded", "1");
      }
      window.__vivaBackPageShows = [];
      window.addEventListener("pageshow", (event) => {
        window.__vivaBackPageShows.push({ persisted: event.persisted, path: location.pathname });
      });
    })();`,
  });

  await client.send("Page.navigate", { url: `${baseUrl}/checkout` });
  await waitFor(`!!document.querySelector('input[name="email"]')`, "checkout contact form");

  await evaluate(`(() => {
    const setValue = (name, value) => {
      const input = document.querySelector('[name="' + name + '"]');
      if (!input) throw new Error("Missing checkout field: " + name);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    setValue("email", "viva-back-browser@example.test");
    setValue("phone", "+40700000123");
  })()`);
  await clickButton("Next");
  await waitFor(`!!document.querySelector('input[name="shippingAddress.firstName"]')`, "checkout address form");

  await evaluate(`(() => {
    const setValue = (name, value) => {
      const input = document.querySelector('[name="' + name + '"]');
      if (!input) throw new Error("Missing checkout field: " + name);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    setValue("shippingAddress.firstName", "Browser");
    setValue("shippingAddress.lastName", "Test");
    setValue("shippingAddress.address", "Test Street 1");
    setValue("shippingAddress.city", "Bucharest");
    setValue("shippingAddress.state", "Bucharest");
    setValue("shippingAddress.county", "Bucharest");
    setValue("shippingAddress.zipCode", "010101");
    setValue("shippingAddress.phone", "+40700000123");
    const sameAsShipping = document.querySelector('[role="checkbox"]');
    if (!sameAsShipping) throw new Error("Could not find same-as-shipping checkbox");
    sameAsShipping.click();
  })()`);
  await clickButton("Next");
  await waitFor(
    `!!document.querySelector("#viva") && [...document.querySelectorAll("button")].some((button) => /^Pay\\b/.test(button.textContent.trim()))`,
    "Viva payment form",
  );

  client.onEvent = (event) => {
    if (event.method !== "Fetch.requestPaused") return;
    void (async () => {
      const { requestId, request } = event.params;
      if (new URL(request.url).pathname === "/api/payments/viva/create-order") {
        paymentRequests.push({ method: request.method, url: request.url });
        const isControlledFailure = paymentRequests.length === 2;
        const body = Buffer.from(JSON.stringify({
          ...(isControlledFailure
            ? { error: "Controlled Viva order-creation failure" }
            : {
                checkoutUrl: `${baseUrl}/cart?viva-back-browser-test=1`,
                dbOrderId: 352001,
              }),
        })).toString("base64");
        await client.send("Fetch.fulfillRequest", {
          requestId,
          responseCode: isControlledFailure ? 503 : 200,
          responseHeaders: [{ name: "Content-Type", value: "application/json" }],
          body,
        });
      } else {
        await client.send("Fetch.continueRequest", { requestId });
      }
    })().catch((error) => interceptionErrors.push(error.message));
  };
  await client.send("Fetch.enable", {
    patterns: [{ urlPattern: "*://*/api/payments/viva/create-order*", requestStage: "Request" }],
  });

  await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => /^Pay\\b/.test(candidate.textContent.trim()));
    if (!button || button.disabled) throw new Error("Viva pay button is not available");
    button.click();
  })()`);
  await waitFor(`location.pathname === "/cart" && location.search.includes("viva-back-browser-test=1")`, "simulated Viva checkout page");
  assert.deepEqual(interceptionErrors, [], "the mock checkout redirect completed without browser interception errors");
  assert.equal(paymentRequests.length, 1, "the Viva create-order request was intercepted and never reached the payment provider");
  assert.equal(paymentRequests[0].method, "POST");

  await evaluate("history.back()");
  await waitFor(`location.pathname === "/checkout" && !!document.querySelector("#viva")`, "checkout restored after browser Back");
  const restoredPageShows = await evaluate(`window.__vivaBackPageShows || []`);
  assert.ok(
    restoredPageShows.some((event) => event.path === "/checkout" && event.persisted),
    `browser Back restored checkout from the back-forward cache; pageshow events: ${JSON.stringify(restoredPageShows)}`,
  );

  const vivaState = await evaluate(`(() => {
    const payButton = [...document.querySelectorAll("button")]
      .find((candidate) => /^Pay\\b/.test(candidate.textContent.trim()));
    return {
      disabled: payButton?.disabled ?? null,
      label: payButton?.textContent.trim() ?? "",
    };
  })()`);
  assert.equal(vivaState.disabled, false, "the restored Viva button is enabled");
  assert.ok(vivaState.label.startsWith("Pay "), "the restored Viva button is no longer showing a redirect/loading state");

  await evaluate(`(() => {
    const button = [...document.querySelectorAll("button")]
      .find((candidate) => /^Pay\\b/.test(candidate.textContent.trim()));
    if (!button || button.disabled) throw new Error("Viva pay button is not available for the failure test");
    button.click();
  })()`);
  await waitFor(
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((candidate) => /^Pay\\b/.test(candidate.textContent.trim()));
      return !!button && !button.disabled && button.textContent.trim().startsWith("Pay ");
    })()`,
    "Viva button returns to idle after a controlled create-order failure",
  );
  assert.equal(paymentRequests.length, 2, "the failed create-order request was intercepted before reaching Viva");
  assert.equal(paymentRequests[1].method, "POST");
  assert.ok(
    await evaluate(`document.body.innerText.includes("Controlled Viva order-creation failure")`),
    "the checkout reports the controlled payment failure",
  );

  const alternateMethod = await evaluate(`(() => {
    const option = document.querySelector("#cash") || document.querySelector("#paypal");
    if (!option) return null;
    option.click();
    return option.id;
  })()`);
  assert.ok(alternateMethod, "another payment method is available");
  await waitFor(
    `document.querySelector(${JSON.stringify(`#${alternateMethod}`)})?.getAttribute("aria-checked") === "true"`,
    `${alternateMethod} payment method selected`,
  );
  assert.equal(
    await evaluate(`[...document.querySelectorAll("button")].some((button) => /^Pay\\b/.test(button.textContent.trim()))`),
    false,
    "selecting another payment method leaves the Viva payment form",
  );
  assert.equal(paymentRequests.length, 2, "changing payment methods does not start another payment");
  assert.deepEqual(interceptionErrors, [], "the controlled payment failure was fulfilled without browser interception errors");
});
