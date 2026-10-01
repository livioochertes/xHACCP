import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";

const base = process.env.PUBLIC_RENDERING_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const chromium = process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

test("public content stays visible without JavaScript and during data loading, then enhances cleanly", { timeout: 60000 }, async () => {
  const profile = await mkdtemp(join(tmpdir(), "public-rendering-browser-"));
  const browser = spawn(chromium, [
    "--headless", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu",
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank",
  ]);
  let output = "";
  browser.stderr.on("data", chunk => { output += chunk; });
  let socket;
  const pending = new Map();
  let nextId = 0;
  const errors = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;
  const waitFor = async expression => {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`Browser condition did not become true: ${expression}`);
  };
  try {
    let endpoint;
    for (let i = 0; i < 100; i++) {
      endpoint = output.match(/DevTools listening on (ws:\/\/[^\s]+)/)?.[1];
      if (endpoint) break;
      await sleep(50);
    }
    assert.ok(endpoint, "Chromium exposes DevTools");
    const port = new URL(endpoint).port;
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.once("open", resolve); socket.once("error", reject); });
    socket.on("message", raw => {
      const message = JSON.parse(raw.toString());
      if (message.id) {
        const request = pending.get(message.id);
        pending.delete(message.id);
        message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
      } else if (message.method === "Runtime.exceptionThrown") {
        errors.push(message.params.exceptionDetails.text);
      } else if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
        errors.push(message.params.args.map(arg => arg.value || arg.description).join(" "));
      }
    });
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setScriptExecutionDisabled", { value: true });
    await send("Page.navigate", { url: `${base}/products` });
    await waitFor("!!document.querySelector('#public-root a[href^=\"/products/\"]')");
    assert.equal(await evaluate("document.querySelector('#public-root').getBoundingClientRect().height > 100"), true);
    assert.equal(await evaluate("document.querySelector('#root').hidden"), true);
    await send("Emulation.setScriptExecutionDisabled", { value: false });
    await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/products?*", requestStage: "Request" }] });
    await send("Page.navigate", { url: `${base}/products` });
    await waitFor("!!document.querySelector('#root h1')");
    assert.equal(await evaluate("!!document.querySelector('#public-root a[href^=\"/products/\"]') && document.querySelector('#root').hidden"), true);
    await send("Fetch.disable");
    await waitFor("!document.getElementById('public-root') && document.querySelector('#root').hidden === false");
    assert.equal(await evaluate("document.querySelectorAll('#root a[href^=\"/products/\"]').length > 0"), true);
    await send("Page.navigate", { url: `${base}/chef-event` });
    await waitFor("!document.getElementById('public-root') && !!document.querySelector('input[name=\"email\"], input[type=\"email\"]')");
    assert.match(await evaluate("document.title"), /20 %/);
    assert.deepEqual(errors, [], `No hydration or runtime errors: ${errors.join("\n")}`);
  } finally {
    socket?.close();
    browser.kill("SIGKILL");
    await new Promise(resolve => browser.once("exit", resolve));
    await rm(profile, { recursive: true, force: true });
  }
});