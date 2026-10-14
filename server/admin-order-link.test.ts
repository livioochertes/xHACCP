import assert from "node:assert/strict";
import test from "node:test";
import { buildAdminOrderUrl } from "./admin-order-link";

test("builds direct admin links for each marketplace order", () => {
  assert.equal(buildAdminOrderUrl(123, "ro"), "https://xhaccp.ro/admin?order=123");
  assert.equal(buildAdminOrderUrl(456, "fr"), "https://xhaccp.fr/admin?order=456");
  assert.equal(buildAdminOrderUrl(789, "com"), "https://xhaccp.com/admin?order=789");
});

test("defaults an unknown order market to the Romanian admin", () => {
  assert.equal(buildAdminOrderUrl(321, "unknown"), "https://xhaccp.ro/admin?order=321");
});
