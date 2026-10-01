import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Highest patched version required by the advisories in this remediation.
const minimumVersions = {
  "path-to-regexp": "0.1.13",
  browserslist: "4.28.7",
  "fast-xml-parser": "5.7.0",
  sharp: "0.35.4",
  postcss: "8.5.18",
  esbuild: "0.25.0",
  undici: "7.29.0",
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
}

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
  for (const match of lock.matchAll(/^  ([a-z][a-z0-9-]*)@([^:\s(]+)(?:\([^:\n]*\))?:/gm)) {
    const [, name, version] = match;
    if (minimumVersions[name]) {
      assertPatched(name, version, `pnpm-lock.yaml:${name}`);
      found.add(name);
    }
  }
  assert.deepEqual([...found].sort(), Object.keys(minimumVersions).sort());
});

test("updated XML parser and builder preserve invoice-style XML round trips", async () => {
  const { XMLBuilder, XMLParser } = await import("fast-xml-parser");
  const options = { ignoreAttributes: false };
  const document = { invoice: { "@_currency": "EUR", item: { name: "Chef & HACCP", quantity: 2 } } };
  const xml = new XMLBuilder(options).build(document);
  assert.deepEqual(new XMLParser(options).parse(xml), document);
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