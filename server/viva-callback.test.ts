import assert from "node:assert/strict";
import test from "node:test";
import { isVivaCancelCallback } from "./viva-callback";

test("Viva cancellation callbacks are recognized regardless of query-key casing", () => {
  assert.equal(isVivaCancelCallback({ Cancel: "1", s: "3552393729164528" }), true);
  assert.equal(isVivaCancelCallback({ cancel: "1" }), true);
  assert.equal(isVivaCancelCallback({ cAnCeL: "1" }), true);
  assert.equal(isVivaCancelCallback({ s: "3552393729164528", lang: "fr-FR" }), false);
});
