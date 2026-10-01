import assert from "node:assert/strict";
import test from "node:test";
import {
  getAdminSuspensionError,
  normalizeAdminEmail,
  normalizeAdminMarketAssignments,
} from "./admin-account-management";

test("normalizes valid admin email addresses and rejects invalid input", () => {
  assert.equal(normalizeAdminEmail("  Admin@Example.test "), "admin@example.test");
  assert.equal(normalizeAdminEmail("not-an-email"), null);
  assert.equal(normalizeAdminEmail("a".repeat(256) + "@example.test"), null);
  assert.equal(normalizeAdminEmail(null), null);
});

test("validates and deduplicates admin market assignments", () => {
  assert.deepEqual(
    normalizeAdminMarketAssignments(["RO", "fr", "ro"]),
    ["ro", "fr"],
  );
  assert.equal(normalizeAdminMarketAssignments([]), null);
  assert.equal(normalizeAdminMarketAssignments(["global"]), null);
  assert.equal(normalizeAdminMarketAssignments(["fr", 2]), null);
});

test("prevents self-suspension and suspension of the last active superadmin", () => {
  assert.equal(getAdminSuspensionError({
    targetId: 4,
    callerId: 4,
    targetMarkets: [],
    activeSuperAdminCount: 2,
    nextSuspended: true,
  }), "cannot_suspend_self");

  assert.equal(getAdminSuspensionError({
    targetId: 5,
    callerId: 4,
    targetMarkets: [],
    activeSuperAdminCount: 1,
    nextSuspended: true,
  }), "cannot_suspend_last_superadmin");

  assert.equal(getAdminSuspensionError({
    targetId: 6,
    callerId: 4,
    targetMarkets: ["fr"],
    activeSuperAdminCount: 1,
    nextSuspended: true,
  }), null);
});