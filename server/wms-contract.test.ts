import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlaintextWmsApiKey,
  decodeWmsCursor,
  encodeWmsCursor,
  hashWmsApiKey,
  isFulfillable,
  normalizeEventStatus,
  standardError,
} from "./wms-service.js";

test("WMS API keys are prefixed and only their SHA-256 hash is used", () => {
  const generated = createPlaintextWmsApiKey("production");
  assert.match(generated.plaintext, /^wms_live_/);
  assert.equal(generated.hash, hashWmsApiKey(generated.plaintext));
  assert.notEqual(generated.hash, generated.plaintext);
});

test("sandbox keys use a separate prefix", () => {
  assert.match(createPlaintextWmsApiKey("sandbox").plaintext, /^wms_test_/);
});

test("cursor encoding is stable and round-trips UTC timestamps", () => {
  const timestamp = new Date("2026-09-09T12:00:00.000Z");
  const cursor = encodeWmsCursor(timestamp, 42);
  const decoded = decodeWmsCursor(cursor);
  assert.ok(decoded);
  assert.equal(decoded!.id, 42);
  assert.equal(decoded!.confirmedAt.toISOString(), timestamp.toISOString());
  assert.equal(decodeWmsCursor("not-a-cursor"), null);
});

test("fulfillment eligibility requires payment and a confirmed partner snapshot", () => {
  const base = {
    paymentStatus: "paid",
    paymentMethod: "card",
    fulfillmentPartnerId: 9,
    confirmedAt: new Date(),
    fulfillmentStatus: "ready",
  };
  assert.equal(isFulfillable(base), true);
  assert.equal(isFulfillable({ ...base, paymentStatus: "pending" }), false);
  assert.equal(isFulfillable({ ...base, fulfillmentPartnerId: null }), false);
  assert.equal(isFulfillable({ ...base, paymentStatus: "pending", paymentMethod: "cod" }), true);
});

test("event aliases map to one forward-only state vocabulary", () => {
  assert.equal(normalizeEventStatus("ACK"), "acknowledged");
  assert.equal(normalizeEventStatus("in-transit"), null);
  assert.equal(normalizeEventStatus("canceled"), "cancelled");
  assert.equal(normalizeEventStatus("shipped"), "shipped");
});

test("WMS errors keep a consistent request correlation shape", () => {
  assert.deepEqual(standardError("ORDER_NOT_FOUND", "Order not found", "req-123"), {
    error: { code: "ORDER_NOT_FOUND", message: "Order not found", request_id: "req-123" },
  });
});