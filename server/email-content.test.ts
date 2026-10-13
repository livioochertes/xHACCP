import test from "node:test";
import assert from "node:assert/strict";
import { nonEmptyEmailContent } from "./email-content";

test("text-only alerts never include an empty HTML part", () => {
  assert.deepEqual(nonEmptyEmailContent("Payment alert", ""), { text: "Payment alert" });
});
test("HTML-only emails never include an empty text part", () => {
  assert.deepEqual(nonEmptyEmailContent("", "<p>Payment alert</p>"), { html: "<p>Payment alert</p>" });
});
test("valid multipart emails preserve both formats", () => {
  assert.deepEqual(nonEmptyEmailContent("Alert", "<p>Alert</p>"), { text: "Alert", html: "<p>Alert</p>" });
});
