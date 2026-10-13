import assert from "node:assert/strict";
import test from "node:test";
import { VIVA_USER_AGENT, withVivaUserAgent } from "./viva-http";

test("Viva requests identify xHACCP and preserve the other request headers", () => {
  assert.deepEqual(
    withVivaUserAgent({
      Accept: "application/json",
      Authorization: "Bearer test-token",
    }),
    {
      Accept: "application/json",
      Authorization: "Bearer test-token",
      "User-Agent": VIVA_USER_AGENT,
    },
  );
});
