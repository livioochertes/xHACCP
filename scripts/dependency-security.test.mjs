import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { test } from "node:test";

// Highest patched version required by the advisories in this remediation.
const minimumVersions = {
  "path-to-regexp": "0.1.13",
  browserslist: "4.28.7",
  "fast-xml-parser": "5.7.0",
  sharp: "0.35.4",
  postcss: "8.5.23",
  esbuild: "0.25.0",
  undici: "7.29.0",
  "shell-quote": "1.9.0",
  ws: "8.21.0",
  picomatch: "2.3.2",
  "form-data": "4.0.6",
  tmp: "0.2.6",
  lodash: "4.18.0",
  uuid: "11.1.1",
  multer: "2.4.0",
  qs: "6.16.0",
  axios: "1.18.0",
  vite: "6.4.3",
  nanoid: "3.3.18",
  yaml: "2.8.3",
  "@anthropic-ai/sdk": "0.91.1",
  "fast-xml-builder": "1.1.7",
  "follow-redirects": "1.16.0",
};
const root = new URL("../", import.meta.url);

function assertPatched(name, version, location) {
  const minimum = minimumVersions[name];
  if (!minimum) return;
  assert.match(version, /^\d+\.\d+\.\d+$/, `${location}: reject prerelease versions`);
  const actual = version.split(".").map(Number);
  const required = minimum.split(".").map(Number);
  const difference = actual.map((value, index) => value - required[index]).find(Boolean) ?? 0;
  assert.ok(difference >= 0, `${location}: ${name}@${version} must be >=${minimum}`);
  // These advisories have separate patched versions on parallel release lines.
  if (name === "picomatch" && actual[0] === 3) {
    assert.ok(actual[1] > 0 || actual[2] >= 2, `${location}: picomatch 3 requires >=3.0.2`);
  }
  if (name === "picomatch" && actual[0] === 4) {
    assert.ok(actual[1] > 0 || actual[2] >= 4, `${location}: picomatch 4 requires >=4.0.4`);
  }
  if (name === "nanoid" && actual[0] >= 4) {
    assert.ok(actual[0] > 5 || (actual[0] === 5 && (actual[1] > 1 || (actual[1] === 1 && actual[2] >= 16))),
      `${location}: nanoid 4/5 requires >=5.1.16`);
  }
  // GHSA-v6wh-96g9-6wx3 fixes differ across the supported Vite release lines.
  if (name === "vite" && actual[0] === 7) {
    assert.ok(actual[1] > 3 || (actual[1] === 3 && actual[2] >= 5),
      `${location}: vite 7 requires >=7.3.5`);
  }
  if (name === "vite" && actual[0] === 8) {
    assert.ok(actual[1] > 0 || actual[2] >= 16,
      `${location}: vite 8 requires >=8.0.16`);
  }
}

test("security version checks reject every reported vulnerable version and unsafe Vite release line", () => {
  const vulnerable = {
    picomatch: ["2.3.1"],
    yaml: ["2.6.0", "2.8.2"],
    ws: ["8.18.0"],
    "fast-xml-builder": ["1.0.0", "1.1.6"],
    lodash: ["4.17.23"],
    postcss: ["8.4.47", "8.5.22"],
    "@anthropic-ai/sdk": ["0.82.0", "0.91.0"],
    "follow-redirects": ["1.15.11"],
    multer: ["2.1.1", "2.3.0"],
    qs: ["6.14.2", "6.15.3"],
    axios: ["1.13.5", "1.17.0"],
    vite: ["5.4.19", "5.4.21", "6.4.2", "7.3.1", "7.3.4", "8.0.15"],
  };
  for (const [name, versions] of Object.entries(vulnerable)) {
    for (const version of versions) {
      assert.throws(() => assertPatched(name, version, "regression fixture"),
        assert.AssertionError, `${name}@${version} must be rejected`);
    }
  }
  for (const [name, version] of [
    ["picomatch", "2.3.2"], ["yaml", "2.8.3"], ["ws", "8.22.0"],
    ["fast-xml-builder", "1.3.1"], ["lodash", "4.18.1"], ["postcss", "8.5.28"],
    ["@anthropic-ai/sdk", "0.91.1"], ["follow-redirects", "1.16.1"],
    ["multer", "2.4.0"], ["qs", "6.16.0"], ["axios", "1.18.0"],
    ["vite", "6.4.3"], ["vite", "7.3.5"], ["vite", "8.0.16"],
  ]) {
    assert.doesNotThrow(() => assertPatched(name, version, "patched fixture"));
  }
});

for (const file of ["package-lock.json", "artifacts/mockup-sandbox/package-lock.json"]) {
  test(`${file} contains no versions affected by the targeted advisories`, () => {
    const lock = JSON.parse(readFileSync(new URL(file, root), "utf8"));
    let checked = 0;
    for (const [location, entry] of Object.entries(lock.packages)) {
      const name = location.split("node_modules/").at(-1);
      if (minimumVersions[name]) {
        assertPatched(name, entry.version, `${file}:${location}`);
        checked++;
      }
    }
    assert.ok(checked > 0, `No target dependencies found in ${file}`);
  });
}

test("pnpm lockfile contains no versions affected by the targeted advisories", () => {
  const lock = readFileSync(new URL("pnpm-lock.yaml", root), "utf8");
  const found = new Set();
  const resolutions = lock.slice(lock.indexOf("\npackages:\n"));
  for (const match of resolutions.matchAll(/^  ['"]?((?:@[a-z0-9-]+\/)?[a-z][a-z0-9-]*)@([^:'"\s(]+)(?:\([^:\n]*\))?['"]?:/gm)) {
    const [, name, version] = match;
    if (minimumVersions[name]) {
      assertPatched(name, version, `pnpm-lock.yaml:${name}`);
      found.add(name);
    }
  }
  assert.deepEqual([...found].sort(), Object.keys(minimumVersions).sort());
});

test("installed packages match patched resolutions in both npm lockfiles", () => {
  for (const file of ["package-lock.json", "artifacts/mockup-sandbox/package-lock.json"]) {
    const lockUrl = new URL(file, root);
    const lock = JSON.parse(readFileSync(lockUrl, "utf8"));
    for (const [location, entry] of Object.entries(lock.packages)) {
      const name = location.split("node_modules/").at(-1);
      if (!minimumVersions[name]) continue;
      const installed = JSON.parse(readFileSync(new URL(`${location}/package.json`, lockUrl), "utf8"));
      assert.equal(installed.version, entry.version, `${file}:${location}: installed version differs from lockfile`);
      assertPatched(name, installed.version, `${file}:${location}:installed`);
    }
  }
});

test("shell quoting rejects injected operators and large argument lists parse within a time limit", () => {
  const require = createRequire(import.meta.url);
  const { quote } = require("shell-quote");
  assert.throws(() => quote([{ op: ";\nid" }]), TypeError);
  execFileSync(process.execPath, ["-e", `
    const assert = require('node:assert/strict');
    const { parse, quote } = require('shell-quote');
    assert.equal(parse('x '.repeat(64000)).length, 64000);
    assert.deepEqual(parse(quote(['hello world', 'safe;literal'])), ['hello world', 'safe;literal']);
  `], { cwd: root, timeout: 5000 });
});

test("glob matching handles crafted extglobs without blocking the event loop", () => {
  execFileSync(process.execPath, ["-e", `
    const assert = require('node:assert/strict');
    const { createRequire } = require('node:module');
    const picomatch = createRequire(require.resolve('micromatch'))('picomatch');
    assert.equal(picomatch('*.xlsx')('catalog.xlsx'), true);
    for (const pattern of ['+(a|aa)', '+(+(a))', '*(+(a))']) {
      assert.equal(picomatch(pattern)('a'.repeat(41) + '!'), false);
    }
  `], { cwd: root, timeout: 5000 });
});

test("Lodash rejects code injection through template import names", () => {
  const require = createRequire(import.meta.url);
  const lodash = require("lodash");
  assert.equal(lodash.template("Hello <%= name %>")({ name: "Chef" }), "Hello Chef");
  assert.throws(() => lodash.template("", { imports: { "x = (() => 1)()": 1 } }));
});

test("temporary files reject path traversal and still support normal cleanup", () => {
  const require = createRequire(import.meta.url);
  const tmp = require("tmp");
  for (const options of [{ prefix: "../escape" }, { postfix: "/../../escape" }, { dir: "../escape" }]) {
    assert.throws(() => tmp.fileSync(options));
  }
  const file = tmp.fileSync({ prefix: "catalog-", postfix: ".xlsx" });
  file.removeCallback();
});

test("ExcelJS retains CommonJS UUID support, bounds checks, and XLSX round trips", async () => {
  const require = createRequire(import.meta.url);
  const excelRequire = createRequire(require.resolve("exceljs"));
  const uuid = excelRequire("uuid");
  assert.ok(uuid.validate(uuid.v4()));
  assert.throws(() => uuid.v5("test", uuid.v5.DNS, new Uint8Array(8), 4), RangeError);
  const ExcelJS = require("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Catalog");
  sheet.addRow(["Chef product", 12]);
  // Extended conditional formatting reaches ExcelJS's CommonJS UUID caller.
  sheet.addConditionalFormatting({
    ref: "B1",
    rules: [{ type: "dataBar", minLength: 0, maxLength: 100,
      cfvo: [{ type: "min" }, { type: "max" }], color: { argb: "FF00AA00" } }],
  });
  const data = await workbook.xlsx.writeBuffer();
  const restored = new ExcelJS.Workbook();
  await restored.xlsx.load(data);
  assert.equal(restored.getWorksheet("Catalog").getCell("A1").value, "Chef product");
  assert.equal(restored.getWorksheet("Catalog").getCell("B1").value, 12);
  assert.match(sheet.conditionalFormattings[0].rules[0].x14Id, /^\{[0-9A-F-]{36}\}$/);
});

test("patched WebSockets still deliver messages", { timeout: 5000 }, async (t) => {
  const { once } = await import("node:events");
  const { WebSocket, WebSocketServer } = await import("ws");
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  t.after(() => {
    for (const client of server.clients) client.terminate();
    server.close();
  });
  await once(server, "listening");
  server.on("connection", socket => socket.on("message", message => socket.send(message)));
  const client = new WebSocket(`ws://127.0.0.1:${server.address().port}`);
  t.after(() => client.terminate());
  await once(client, "open");
  const received = once(client, "message");
  client.send("catalog update");
  assert.equal((await received)[0].toString(), "catalog update");
});

test("multipart uploads remain compatible with patched Multer and form-data", { timeout: 5000 }, async (t) => {
  const require = createRequire(import.meta.url);
  const { once } = await import("node:events");
  const express = require("express");
  const multer = require("multer");
  const FormData = require("form-data");
  const app = express();
  app.post("/upload", multer({ storage: multer.memoryStorage() }).single("file"),
    (req, res) => res.json({ name: req.file.originalname, content: req.file.buffer.toString() }));
  const server = app.listen(0, "127.0.0.1");
  t.after(() => { server.closeAllConnections(); server.close(); });
  await once(server, "listening");
  const form = new FormData();
  form.append("file", Buffer.from("catalog"), { filename: "catalog.txt" });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/upload`, {
    method: "POST", headers: form.getHeaders(), body: form.getBuffer(),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { name: "catalog.txt", content: "catalog" });
});

test("patched qs safely parses attacker-controlled isBuffer values and nested form fields", () => {
  const require = createRequire(import.meta.url);
  // Exercise the actual copies consumed by Express and Stripe as well as the root copy.
  for (const consumer of ["express", "stripe"]) {
    const qs = createRequire(require.resolve(consumer))("qs");
    assert.deepEqual(qs.parse("customer[name]=Chef&items[0][quantity]=2"),
      { customer: { name: "Chef" }, items: [{ quantity: "2" }] });
    assert.doesNotThrow(() => qs.parse({ isBuffer: "not a function", customer: "Chef" }));
  }
});

test("patched Axios retains JSON request and response compatibility", { timeout: 5000 }, async (t) => {
  const { once } = await import("node:events");
  const { createServer } = await import("node:http");
  const { default: axios } = await import("axios");
  const server = createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ method: req.method, body: JSON.parse(Buffer.concat(chunks).toString()) }));
  });
  t.after(() => { server.closeAllConnections(); server.close(); });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  for (const adapter of ["http", "fetch"]) {
    const response = await axios.post(`http://127.0.0.1:${server.address().port}/`,
      { product: "Chef", quantity: 2 }, { adapter, proxy: false, timeout: 2000 });
    assert.equal(response.status, 200);
    assert.deepEqual(response.data, { method: "POST", body: { product: "Chef", quantity: 2 } });
  }
});

test("updated XML parser and builder preserve invoice-style XML round trips", async () => {
  const { XMLBuilder, XMLParser } = await import("fast-xml-parser");
  const options = { ignoreAttributes: false };
  const document = { invoice: { "@_currency": "EUR", item: { name: "Chef & HACCP", quantity: 2 } } };
  const xml = new XMLBuilder(options).build(document);
  assert.deepEqual(new XMLParser(options).parse(xml), document);
});

test("YAML parsing rejects deep nesting with YAML errors instead of stack overflows", () => {
  const require = createRequire(import.meta.url);
  const YAML = require("yaml");
  assert.deepEqual(YAML.parse("market: FR\nitems:\n  - chef\n"), { market: "FR", items: ["chef"] });
  const payload = "[".repeat(5000) + "1" + "]".repeat(5000);
  assert.throws(() => YAML.parse(payload), YAML.YAMLParseError);
  const document = YAML.parseDocument(payload);
  const documents = YAML.parseAllDocuments(payload);
  for (const doc of [document, ...documents]) {
    assert.ok(doc.errors.length > 0);
    assert.ok(doc.errors.every(error => error instanceof YAML.YAMLParseError));
  }
});

test("Anthropic memory files stay private even with a permissive umask", () => {
  // Run separately so changing umask cannot affect the app or other tests.
  execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from 'node:assert/strict';
    import { mkdtemp, stat, readFile, rm } from 'node:fs/promises';
    import { tmpdir } from 'node:os';
    import { join } from 'node:path';
    import { BetaLocalFilesystemMemoryTool } from '@anthropic-ai/sdk/tools/memory/node';
    const directory = await mkdtemp(join(tmpdir(), 'sdk-memory-security-'));
    const original = process.umask(0);
    try {
      const memory = await BetaLocalFilesystemMemoryTool.init(directory);
      await memory.create({ command: 'create', path: '/memories/catalog/item.txt', file_text: 'Chef' });
      for (const path of ['memories', 'memories/catalog']) {
        assert.equal((await stat(join(directory, path))).mode & 0o777, 0o700);
      }
      const file = join(directory, 'memories/catalog/item.txt');
      assert.equal((await stat(file)).mode & 0o777, 0o600);
      assert.equal(await readFile(file, 'utf8'), 'Chef');
    } finally {
      process.umask(original);
      await rm(directory, { recursive: true, force: true });
    }
  `], { cwd: root, timeout: 5000 });
});

test("patched Anthropic SDK preserves message request and response compatibility", async () => {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({
    apiKey: "local-test-key",
    fetch: async (url, init) => {
      assert.equal(new URL(url).pathname, "/v1/messages");
      const body = JSON.parse(init.body);
      assert.deepEqual(body.messages, [{ role: "user", content: "Catalog" }]);
      assert.equal(body.max_tokens, 32);
      return new Response(JSON.stringify({
        id: "msg_test", type: "message", role: "assistant", model: body.model,
        content: [{ type: "text", text: "Chef" }], stop_reason: "end_turn",
        stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
      }), { headers: { "content-type": "application/json" } });
    },
  });
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 32,
    messages: [{ role: "user", content: "Catalog" }],
  });
  assert.equal(message.content[0].text, "Chef");
});

test("updated Sharp resizes and encodes uploaded images", async () => {
  const { default: sharp } = await import("sharp");
  const png = await sharp({
    create: { width: 32, height: 24, channels: 3, background: "#ffffff" },
  }).png().toBuffer();
  const thumbnail = await sharp(png).resize(16, 12).webp().toBuffer();
  const metadata = await sharp(thumbnail).metadata();
  assert.equal(metadata.width, 16);
  assert.equal(metadata.height, 12);
  assert.equal(metadata.format, "webp");
});