import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import WebSocket from "ws";

const baseUrl = process.env.MARKETING_RECOVERY_BASE_URL || `http://127.0.0.1:${process.env.PORT || 5000}`;
const chromiumPath = process.env.CHROMIUM_PATH ||
  (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : "chromium");
const campaign = {
  id: 32351,
  name: "Browser recovery campaign",
  market: "fr",
  subject: "Recovery test",
  status: "draft",
  segmentId: 1,
  sentCount: 0,
  recipientCount: 0,
  delivery: null,
};

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDevToolsTarget(output) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 10_000) {
    const endpoint = output.join("").match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
    if (endpoint) {
      const response = await fetch(endpoint.replace(/^ws:/, "http:").replace(/\/devtools\/browser\/[^/]+$/, "/json/list"));
      const targets = await response.json();
      const page = targets.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    }
    await sleep(50);
  }
  throw new Error(`Chromium did not expose a DevTools target.\n${output.join("")}`);
}

async function waitForHttpServer() {
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < 10_000) {
    try {
      const response = await fetch(`${baseUrl}/admin`);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`The admin app is not reachable at ${baseUrl}: ${lastError?.message}`);
}

test("deleting and restoring a SendGrid draft updates both admin campaign lists", { timeout: 60000 }, async (t) => {
  await waitForHttpServer();

  const profile = await mkdtemp(join(tmpdir(), "marketing-recovery-browser-"));
  const browser = spawn(chromiumPath, [
    "--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ]);
  const browserOutput = [];
  browser.stderr.on("data", (chunk) => browserOutput.push(chunk.toString()));
  let client;
  const browserErrors = [];
  const apiCalls = [];
  let deletedAt = null;

  t.after(async () => {
    client?.close();
    browser.kill("SIGKILL");
    await new Promise((resolve) => browser.once("exit", resolve));
    await rm(profile, { recursive: true, force: true });
  });

  client = new DevToolsClient(await (async () => {
    const socketUrl = await waitForDevToolsTarget(browserOutput);
    const socket = new WebSocket(socketUrl);
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    return socket;
  })());

  const evaluate = async (expression) => {
    const result = await client.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < 10_000) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    const pageText = await evaluate(`document.querySelector("#admin-root")?.innerText || ""`);
    throw new Error(`Browser condition did not become true: ${expression}\nPage text: ${pageText}\nMock state: ${JSON.stringify({ deletedAt, apiCalls })}`);
  };

  client.onEvent = (event) => {
    if (event.method === "Runtime.exceptionThrown") {
      browserErrors.push(event.params.exceptionDetails.text);
    } else if (event.method === "Runtime.consoleAPICalled" && event.params.type === "error") {
      browserErrors.push(event.params.args.map((arg) => arg.value || arg.description).join(" "));
    } else if (event.method === "Fetch.requestPaused") {
      void (async () => {
      const { requestId, request } = event.params;
        const url = new URL(request.url);
        const pathname = url.pathname;
        if (!pathname.startsWith("/admin/api/")) {
          await client.send("Fetch.continueRequest", { requestId });
          return;
        }

        apiCalls.push(`${request.method} ${pathname}${url.search}`);
        let status = 200;
        let responseBody = [];
        if (pathname === "/admin/api/marketing/campaigns" && request.method === "GET") {
          responseBody = deletedAt ? [] : [campaign];
        } else if (pathname === "/admin/api/marketing/campaigns/recovery" && request.method === "GET") {
          responseBody = deletedAt
            ? [{ ...campaign, deletedAt, expiresAt: new Date(new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() }]
            : [];
        } else if (pathname === `/admin/api/marketing/campaigns/${campaign.id}` && request.method === "DELETE") {
          deletedAt = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();
          responseBody = { success: true };
        } else if (pathname === `/admin/api/marketing/campaigns/${campaign.id}/restore` && request.method === "POST") {
          deletedAt = null;
          responseBody = { success: true };
        } else if (pathname === "/admin/api/marketing/segments" || pathname === "/admin/api/marketing/event-voucher-contacts" || pathname === "/admin/api/marketing/prospects/lists") {
          responseBody = [];
        } else if (pathname === "/admin/api/markets") {
          responseBody = [];
        }

        await client.send("Fetch.fulfillRequest", {
          requestId,
          responseCode: status,
          responseHeaders: [{ name: "Content-Type", value: "application/json" }],
          body: Buffer.from(JSON.stringify(responseBody)).toString("base64"),
        });
      })().catch((error) => browserErrors.push(`API mock failed: ${error.message}`));
    }
  };

  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Fetch.enable", {
    patterns: [{ urlPattern: "*://*/admin/api/*", requestStage: "Request" }],
  });
  await client.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `(() => {
      localStorage.setItem("adminToken", "browser-test-token");
      localStorage.setItem("adminLang", "en");
      localStorage.setItem("adminUser", JSON.stringify({
        id: 323,
        email: "browser-test@example.invalid",
        role: "admin",
        adminMarkets: ["fr"]
      }));
      window.confirm = () => true;
      window.alert = (message) => { window.__lastAlert = message; };
    })();`,
  });
  await client.send("Page.navigate", { url: `${baseUrl}/admin` });

  await waitFor(`!!document.querySelector("#admin-root .admin-nav-group-button")`);
  await evaluate(`(() => {
    const group = [...document.querySelectorAll("button")].find(button => button.textContent.includes("Marketing & promotions"));
    group?.click();
  })()`);
  await waitFor(`!![...document.querySelectorAll(".admin-nav-link")].find(button => button.textContent.trim() === "Marketing")`);
  await evaluate(`(() => {
    [...document.querySelectorAll(".admin-nav-link")].find(button => button.textContent.trim() === "Marketing")?.click();
  })()`);
  await waitFor(`document.querySelector("#admin-root")?.innerText.includes("SendGrid campaigns") && document.querySelector("#admin-root")?.innerText.includes("Browser recovery campaign")`);

  const availableDeleteButton = `() => [...document.querySelectorAll("#admin-root button")].filter(button => button.textContent.trim() === "Delete draft").length`;
  assert.equal(await evaluate(`(${availableDeleteButton})()`), 1, "active campaign is displayed with its delete action");

  await evaluate(`(() => [...document.querySelectorAll("#admin-root button")].find(button => button.textContent.trim() === "Delete draft")?.click())()`);
  await waitFor(`document.querySelector("#admin-root")?.innerText.includes("Deleted drafts") && document.querySelector("#admin-root")?.innerText.includes("Available until")`);
  assert.ok(
    await evaluate(`document.querySelector("#admin-root")?.innerText.includes("Expires in 5 days")`),
    "drafts nearing expiry show the remaining time",
  );
  assert.equal(await evaluate(`(${availableDeleteButton})()`), 0, "deleted campaign is absent from the active list");
  assert.equal(
    await evaluate(`document.querySelector("#admin-root")?.innerText.includes("Browser recovery campaign")`),
    true,
    "deleted campaign remains in recovery",
  );

  await evaluate(`(() => [...document.querySelectorAll("#admin-root button")].find(button => button.textContent.trim() === "Restore draft")?.click())()`);
  await waitFor(`document.querySelector("#admin-root")?.innerText.includes("Browser recovery campaign") && [...document.querySelectorAll("#admin-root button")].some(button => button.textContent.trim() === "Delete draft")`);
  await waitFor(`[...document.querySelectorAll("#admin-root button")].every(button => button.textContent.trim() !== "Restore draft")`);
  assert.equal(await evaluate(`(${availableDeleteButton})()`), 1, "restored campaign returns to the active list");
  assert.equal(await evaluate(`[...document.querySelectorAll("#admin-root button")].some(button => button.textContent.trim() === "Restore draft")`), false, "restored campaign is removed from recovery");
  assert.ok(apiCalls.some((call) => call.startsWith("DELETE /admin/api/marketing/campaigns/32351")));
  assert.ok(apiCalls.some((call) => call.startsWith("POST /admin/api/marketing/campaigns/32351/restore")));
  assert.ok(apiCalls.filter((call) => call.includes("/marketing/campaigns/recovery?market=fr")).length >= 3, "refreshes recovery after delete and restore");
  assert.deepEqual(browserErrors, [], `No browser or mocked API errors: ${browserErrors.join("\n")}`);
});
