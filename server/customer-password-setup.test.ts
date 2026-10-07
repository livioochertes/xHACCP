import assert from "node:assert/strict";
import test from "node:test";
import {
  hashPasswordSetupToken,
  isPasswordSetupTokenUsable,
} from "./customer-password-setup";

test("password setup tokens are hashed and reject malformed values", () => {
  const rawToken = "a".repeat(43);
  const hash = hashPasswordSetupToken(rawToken);
  assert.equal(hash?.length, 64);
  assert.notEqual(hash, rawToken);
  assert.equal(hashPasswordSetupToken("short"), null);
});

test("password setup tokens reject expired or previously consumed links", () => {
  const now = new Date("2026-10-07T12:00:00.000Z");
  assert.equal(isPasswordSetupTokenUsable({ expiresAt: new Date("2026-10-08T12:00:00.000Z"), usedAt: null }, now), true);
  assert.equal(isPasswordSetupTokenUsable({ expiresAt: new Date("2026-10-07T11:59:59.000Z"), usedAt: null }, now), false);
  assert.equal(isPasswordSetupTokenUsable({ expiresAt: new Date("2026-10-08T12:00:00.000Z"), usedAt: now }, now), false);
});
